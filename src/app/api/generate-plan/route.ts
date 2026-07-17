import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  aiClinicalReview,
  AiReviewSchema,
  DietPlanSchema,
  generateDietPlan,
  isPauseDecision,
  type AiReview,
  type DietPlan,
} from "@/lib/nim";
import { groundPlan } from "@/lib/nutrition";
import { nutritionTopUp } from "@/lib/protein-topup";
import { auditPlan } from "@/lib/match-audit";
import { renderPlanPdf } from "@/lib/pdf";
import { missingRequired, type Answers } from "@/lib/counselling/questions";
import type { FollowUpInput, IntakeForm } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const BodySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("first"),
    form: z.record(z.any()),
    appointmentId: z.string().uuid().optional(),
  }),
  z.object({
    type: z.literal("followup"),
    clientId: z.string().uuid(),
    followup: z.record(z.any()),
  }),
  z.object({ type: z.literal("regenerate"), clientId: z.string().uuid() }),
  // Dietitian review of a draft preview: written change instructions the AI
  // must apply, or approval that renders the final PDF.
  z.object({
    type: z.literal("revise"),
    planId: z.string().uuid(),
    instructions: z.string().trim().min(1),
  }),
  z.object({ type: z.literal("approve"), planId: z.string().uuid() }),
]);

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && v !== "" && v !== null ? n : null;
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Draft review actions operate on an existing plan row and share none of
  // the generation bookkeeping below.
  if (body.type === "revise" || body.type === "approve") {
    return handleDraftReview(supabase, user, body);
  }

  let clientId: string | undefined;
  let clientName: string;
  let intake: IntakeForm;
  let week: number;
  let source: "first_counselling" | "follow_up";
  let followup: FollowUpInput | null = null;
  let previousPlan: DietPlan | null = null;
  let aiReview: AiReview | null = null;

  // The AI independently reviews the complete client profile + the dietitian's
  // hypothesis before any Week-1 diet is generated (LeanR Premium). A failed
  // review call never blocks generation; a PAUSE decision does.
  const runReview = async (form: IntakeForm): Promise<AiReview | null> => {
    try {
      return await aiClinicalReview(form);
    } catch (e) {
      console.warn(
        "AI clinical review unavailable — generating without it:",
        e instanceof Error ? e.message : e
      );
      return null;
    }
  };
  const pauseResponse = (review: AiReview, extra: Record<string, unknown> = {}) =>
    NextResponse.json(
      {
        error:
          "AI clinical review paused diet generation — " +
          [...review.missing_information, ...review.safety_concerns].join("; ") +
          (review.reasoning ? ` (${review.reasoning})` : ""),
        paused: true,
        aiReview: review,
        ...extra,
      },
      { status: 422 }
    );

  try {
    if (body.type === "first") {
      intake = body.form as unknown as IntakeForm;
      if (!intake.fullName?.trim()) {
        return NextResponse.json({ error: "Client name is required" }, { status: 400 });
      }

      // Mandatory questions are enforced server-side too — the plan may only
      // be generated from a complete counselling (legacy flat intakes without
      // `answers` are not subject to this).
      const answers = (intake as IntakeForm & { answers?: Answers }).answers;
      if (answers && typeof answers === "object") {
        const missing = missingRequired(answers);
        if (missing.length > 0) {
          const preview = missing
            .slice(0, 5)
            .map((m) => `${m.sectionTitle} — ${m.label}`)
            .join("; ");
          return NextResponse.json(
            {
              error: `${missing.length} mandatory counselling question${missing.length > 1 ? "s are" : " is"} unanswered: ${preview}${missing.length > 5 ? " …" : ""}`,
            },
            { status: 400 }
          );
        }

        // Independent clinical review BEFORE the client record is created —
        // on a pause nothing is persisted and the counselling stays a draft,
        // so the dietitian can address the gaps and resubmit.
        aiReview = await runReview(intake);
        if (aiReview && isPauseDecision(aiReview)) return pauseResponse(aiReview);
      }

      const { data: client, error } = await supabase
        .from("clients")
        .insert({
          dietitian_id: user.id,
          full_name: intake.fullName.trim(),
          age: toNum(intake.age),
          gender: intake.gender || null,
          height_cm: toNum(intake.heightCm),
          weight_kg: toNum(intake.weightKg),
          goal: intake.goal || null,
          diet_type: intake.dietType || null,
          phone: intake.phone || null,
          email: intake.email || null,
          intake,
        })
        .select("id, full_name")
        .single();
      if (error) throw new Error(`Could not save client: ${error.message}`);

      clientId = client.id;
      clientName = client.full_name;
      week = 1;
      source = "first_counselling";

      // Started from Today's Activity — the counselling happened, so mark the
      // appointment completed and link the client (RLS limits this to the
      // dietitian's own emp_code rows; a mismatch just updates nothing).
      if (body.appointmentId) {
        await supabase
          .from("counselling_appointments")
          .update({
            status: "completed",
            client_id: clientId,
            completed_at: new Date().toISOString(),
          })
          .eq("id", body.appointmentId);
      }
    } else {
      clientId = body.clientId;
      const { data: client, error } = await supabase
        .from("clients")
        .select("id, full_name, intake")
        .eq("id", clientId)
        .single();
      if (error || !client) {
        return NextResponse.json({ error: "Client not found" }, { status: 404 });
      }
      clientName = client.full_name;
      intake = client.intake as IntakeForm;

      const { data: latest } = await supabase
        .from("diet_plans")
        .select("week_number, plan")
        .eq("client_id", clientId)
        .order("week_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (body.type === "followup") {
        followup = body.followup as unknown as FollowUpInput;
        week = (latest?.week_number ?? 0) + 1;
        source = "follow_up";

        const parsedPrev = latest ? DietPlanSchema.safeParse(latest.plan) : null;
        previousPlan = parsedPrev?.success ? parsedPrev.data : null;

        const { error: fuError } = await supabase.from("followups").insert({
          client_id: clientId,
          dietitian_id: user.id,
          week_number: week,
          weight_kg: toNum(followup.weightKg),
          adherence: followup.adherence || null,
          complaints: followup.complaints || null,
          notes: followup.notes || null,
          data: followup,
        });
        if (fuError) throw new Error(`Could not save follow-up: ${fuError.message}`);

        // Keep the client's current weight up to date
        if (toNum(followup.weightKg) !== null) {
          await supabase
            .from("clients")
            .update({ weight_kg: toNum(followup.weightKg), updated_at: new Date().toISOString() })
            .eq("id", clientId);
        }
      } else {
        // regenerate: retry the first plan when initial generation failed
        week = latest ? latest.week_number : 1;
        source = latest ? "follow_up" : "first_counselling";

        if (source === "first_counselling") {
          aiReview = await runReview(intake);
          if (aiReview && isPauseDecision(aiReview)) return pauseResponse(aiReview, { clientId });
        }
      }
    }

    // Day 1 is fixed now so the weekday food rules enforced during generation
    // and the PDF's date labels (rendered later, at approval) agree.
    const planStart = new Date();
    planStart.setDate(planStart.getDate() + 1); // plan starts tomorrow
    const startsOn = planStart.toISOString().slice(0, 10);

    // ---- AI generation (server-side; NVIDIA_API_KEY never leaves the server)
    let plan = await generateDietPlan({
      intake,
      week,
      previousPlan,
      followup,
      review: aiReview,
      startsOn,
    });

    // ---- Ground macros in the foods reference table (INDB + USDA). Never
    // fatal: if the table isn't seeded yet, the model estimates are kept.
    let wasGrounded = false;
    try {
      const grounded = await groundPlan(supabase, plan);
      plan = grounded.plan;
      wasGrounded = true;
      console.log(
        `nutrition grounding: ${grounded.stats.grounded_meals}/${grounded.stats.total_meals} meals, ` +
          `${grounded.stats.matched_items}/${grounded.stats.total_items} items ` +
          `(INDB ${grounded.stats.sources.INDB}, USDA ${grounded.stats.sources.USDA}, ` +
          `rescaled ${grounded.stats.rescaled_meals})`
      );
    } catch (groundError) {
      console.warn(
        "nutrition grounding skipped:",
        groundError instanceof Error ? groundError.message : groundError
      );
    }

    // ---- Nutrition top-up: grounded days often land under the protein band
    // or well under the calorie target the model claimed (under-portioned
    // meals). One corrective revision round, kept only if the re-grounded
    // shortfall verifiably shrank. Meaningless without grounding (ungrounded
    // estimates always claim the targets), and never fatal.
    if (wasGrounded) {
      try {
        const topup = await nutritionTopUp(supabase, plan, {
          intake,
          week,
          previousPlan,
          followup,
          review: aiReview,
          startsOn,
        });
        plan = topup.plan;
        console.log(`nutrition top-up ${topup.applied ? "applied" : "skipped"}: ${topup.reason}`);
      } catch (topupError) {
        console.warn(
          "nutrition top-up skipped:",
          topupError instanceof Error ? topupError.message : topupError
        );
      }
    }

    // ---- Match audit: re-check every item's database match and log the ones
    // a dietitian would flag (wrong-dish matches, unmatched items). Purely
    // observational — never blocks the draft. A recurring name here means a
    // staples.json entry is missing.
    if (wasGrounded) {
      try {
        const flagged = (await auditPlan(supabase, plan)).filter((f) => f.verdict !== "ok");
        if (flagged.length > 0) {
          console.warn(
            `match audit: ${flagged.length} item(s) to verify — ` +
              flagged
                .map((f) => `"${f.query}" -> ${f.matchedName ?? "NO MATCH"} [${f.verdict}] ${f.reason}`)
                .join(" | ")
          );
        }
      } catch (auditError) {
        console.warn(
          "match audit skipped:",
          auditError instanceof Error ? auditError.message : auditError
        );
      }
    }

    // ---- Save as a DRAFT preview. The dietitian reviews it on the client
    // page, optionally sends change instructions back ("revise"), and only an
    // approved plan gets its PDF rendered ("approve").
    const { data: planRow, error: planError } = await supabase
      .from("diet_plans")
      .insert({
        client_id: clientId,
        dietitian_id: user.id,
        week_number: week,
        source,
        status: "draft",
        starts_on: startsOn,
        plan,
        ai_review: aiReview,
      })
      .select("id")
      .single();
    if (planError) throw new Error(`Could not save plan: ${planError.message}`);

    // First counselling succeeded — clear the autosaved draft
    if (body.type === "first") {
      await supabase
        .from("form_drafts")
        .delete()
        .eq("dietitian_id", user.id)
        .eq("kind", "first_counselling");
    }

    return NextResponse.json({ clientId, planId: planRow.id, week, status: "draft" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    console.error("generate-plan failed:", message);
    // If the client record was already created, tell the UI so it can offer a retry
    // from the client page instead of losing the intake data.
    const payload: Record<string, unknown> = { error: message };
    if (body.type === "first" && clientId) payload.clientId = clientId;
    return NextResponse.json(payload, { status: 502 });
  }
}

// ---------------------------------------------------------------------------
// Human-in-the-loop draft review.
// "revise": regenerate the draft with the dietitian's written instructions
// woven into the prompt (the same forbidden-food/day-rule enforcement and
// nutrition grounding run again). "approve": render + store the PDF and mark
// the plan final. Both act only on the caller's own rows (RLS).
// ---------------------------------------------------------------------------
async function handleDraftReview(
  supabase: ReturnType<typeof createClient>,
  user: { id: string; email?: string },
  body:
    | { type: "revise"; planId: string; instructions: string }
    | { type: "approve"; planId: string }
) {
  const { data: row } = await supabase
    .from("diet_plans")
    .select("*")
    .eq("id", body.planId)
    .maybeSingle();
  if (!row) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }
  if (row.status !== "draft") {
    return NextResponse.json(
      { error: "This plan has already been approved" },
      { status: 409 }
    );
  }

  const parsedDraft = DietPlanSchema.safeParse(row.plan);
  if (!parsedDraft.success) {
    return NextResponse.json(
      { error: "The stored draft is not a valid plan — regenerate it instead" },
      { status: 422 }
    );
  }
  const draft = parsedDraft.data;

  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name, intake")
    .eq("id", row.client_id)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  const intake = client.intake as IntakeForm;

  try {
    if (body.type === "revise") {
      // Rebuild the same context the draft was generated with, so the revision
      // reasons over the full profile — plus the dietitian's instructions.
      const parsedReview = row.ai_review ? AiReviewSchema.safeParse(row.ai_review) : null;

      const { data: prev } = await supabase
        .from("diet_plans")
        .select("plan")
        .eq("client_id", row.client_id)
        .lt("week_number", row.week_number)
        .order("week_number", { ascending: false })
        .limit(1)
        .maybeSingle();
      const parsedPrev = prev ? DietPlanSchema.safeParse(prev.plan) : null;

      let followup: FollowUpInput | null = null;
      if (row.source === "follow_up") {
        const { data: fu } = await supabase
          .from("followups")
          .select("data")
          .eq("client_id", row.client_id)
          .eq("week_number", row.week_number)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        followup = (fu?.data as FollowUpInput) ?? null;
      }

      let plan = await generateDietPlan({
        intake,
        week: row.week_number,
        previousPlan: parsedPrev?.success ? parsedPrev.data : null,
        followup,
        review: parsedReview?.success ? parsedReview.data : null,
        startsOn: row.starts_on,
        revision: { draft, instructions: body.instructions },
      });

      try {
        const grounded = await groundPlan(supabase, plan);
        plan = grounded.plan;
      } catch (groundError) {
        console.warn(
          "nutrition grounding skipped:",
          groundError instanceof Error ? groundError.message : groundError
        );
      }

      const revisions = [
        ...(Array.isArray(row.revisions) ? row.revisions : []),
        { instructions: body.instructions, at: new Date().toISOString() },
      ];
      const { error: updateError } = await supabase
        .from("diet_plans")
        .update({ plan, revisions })
        .eq("id", row.id);
      if (updateError) throw new Error(`Could not save the revised draft: ${updateError.message}`);

      return NextResponse.json({
        clientId: row.client_id,
        planId: row.id,
        week: row.week_number,
        status: "draft",
      });
    }

    // ---- approve: render the PDF from the reviewed plan and mark it final
    const start = row.starts_on ? new Date(row.starts_on) : null;
    const fallbackStart = new Date();
    fallbackStart.setDate(fallbackStart.getDate() + 1);
    const pdfBuffer = await renderPlanPdf({
      plan: draft,
      clientName: client.full_name,
      weekNumber: row.week_number,
      dietitianName: user.email ?? "Your dietitian",
      generatedOn: new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      startDateIso: (start ?? fallbackStart).toISOString(),
      dietType: intake.dietType || "",
      conditions: Array.isArray(intake.conditions) ? intake.conditions : [],
    });

    const pdfPath = `${user.id}/${row.client_id}/week-${row.week_number}-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("diet-pdfs")
      .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw new Error(`PDF upload failed: ${uploadError.message}`);

    const { error: updateError } = await supabase
      .from("diet_plans")
      .update({ status: "final", pdf_path: pdfPath })
      .eq("id", row.id);
    if (updateError) throw new Error(`Could not finalise the plan: ${updateError.message}`);

    return NextResponse.json({
      clientId: row.client_id,
      planId: row.id,
      week: row.week_number,
      status: "final",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    console.error(`generate-plan ${body.type} failed:`, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

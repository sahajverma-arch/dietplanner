import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateDietPlan, DietPlanSchema, type DietPlan } from "@/lib/nim";
import { groundPlan } from "@/lib/nutrition";
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

  let clientId: string | undefined;
  let clientName: string;
  let intake: IntakeForm;
  let week: number;
  let source: "first_counselling" | "follow_up";
  let followup: FollowUpInput | null = null;
  let previousPlan: DietPlan | null = null;

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
      }
    }

    // ---- AI generation (server-side; NVIDIA_API_KEY never leaves the server)
    let plan = await generateDietPlan({ intake, week, previousPlan, followup });

    // ---- Ground macros in the foods reference table (INDB + USDA). Never
    // fatal: if the table isn't seeded yet, the model estimates are kept.
    try {
      const grounded = await groundPlan(supabase, plan);
      plan = grounded.plan;
      console.log(
        `nutrition grounding: ${grounded.stats.grounded_meals}/${grounded.stats.total_meals} meals, ` +
          `${grounded.stats.matched_items}/${grounded.stats.total_items} items ` +
          `(INDB ${grounded.stats.sources.INDB}, USDA ${grounded.stats.sources.USDA})`
      );
    } catch (groundError) {
      console.warn(
        "nutrition grounding skipped:",
        groundError instanceof Error ? groundError.message : groundError
      );
    }

    // ---- Render PDF and store it in the private bucket under the dietitian's folder
    const planStart = new Date();
    planStart.setDate(planStart.getDate() + 1); // plan starts tomorrow
    const pdfBuffer = await renderPlanPdf({
      plan,
      clientName,
      weekNumber: week,
      dietitianName: user.email ?? "Your dietitian",
      generatedOn: new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      startDateIso: planStart.toISOString(),
      dietType: intake.dietType || "",
      conditions: Array.isArray(intake.conditions) ? intake.conditions : [],
    });

    const pdfPath = `${user.id}/${clientId}/week-${week}-${Date.now()}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("diet-pdfs")
      .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw new Error(`PDF upload failed: ${uploadError.message}`);

    const { data: planRow, error: planError } = await supabase
      .from("diet_plans")
      .insert({
        client_id: clientId,
        dietitian_id: user.id,
        week_number: week,
        source,
        plan,
        pdf_path: pdfPath,
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

    return NextResponse.json({ clientId, planId: planRow.id, week });
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

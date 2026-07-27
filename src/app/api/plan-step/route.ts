import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  AiReviewSchema,
  DAY_BATCHES,
  DietPlanSchema,
  PlanDaysSchema,
  PlanOverviewSchema,
  aiClinicalReview,
  assemblePlan,
  generatePlanDays,
  generatePlanOverview,
  isPauseDecision,
  type AiReview,
  type DietPlan,
  type PlanContext,
  type PlanOverview,
} from "@/lib/nim";
import { groundPlan } from "@/lib/nutrition";
import { acceptRevision, reconcileNeed } from "@/lib/nutrition-reconcile";
import { auditPlan } from "@/lib/match-audit";
import { missingRequired, type Answers } from "@/lib/counselling/questions";
import type { FollowUpInput, IntakeForm } from "@/lib/types";

export const runtime = "nodejs";
// One step per request, each at most ONE model call with a small response.
// 60s is the free-tier ceiling on Vercel; the whole point of this route is
// that no single step needs more.
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Stepped plan generation.
//
// A week is up to 5 model calls plus a correction round — 2 to 5 minutes,
// which no longer fits in one request. The client drives the steps instead:
// `start` creates the row, then `step` is called until it reports done. State
// lives on the row, so a failed step is retried on its own instead of losing
// the whole generation, and closing the browser leaves a resumable row rather
// than nothing.
//
// /api/generate-plan still does it all in one request for anywhere without a
// timeout (scripts, self-hosting); both drive the same functions.
// ---------------------------------------------------------------------------

// Flat union rather than a nested one: z.discriminatedUnion takes objects, not
// intersections, so each start variant carries both discriminators itself.
const BodySchema = z.union([
  z.object({
    type: z.literal("start"),
    source: z.literal("first"),
    form: z.record(z.any()),
    appointmentId: z.string().uuid().optional(),
  }),
  z.object({
    type: z.literal("start"),
    source: z.literal("followup"),
    clientId: z.string().uuid(),
    followup: z.record(z.any()),
  }),
  z.object({
    type: z.literal("start"),
    source: z.literal("regenerate"),
    clientId: z.string().uuid(),
  }),
  z.object({
    type: z.literal("start"),
    source: z.literal("revise"),
    planId: z.string().uuid(),
    instructions: z.string().trim().min(1),
  }),
  z.object({ type: z.literal("step"), planId: z.string().uuid() }),
]);

/** Scratch state for a generation in flight, stored on the row. */
const GenerationSchema = z.object({
  /** "generate" builds a new week; "revise" applies dietitian instructions. */
  pass: z.enum(["generate", "revise"]),
  overview: PlanOverviewSchema.optional(),
  days: PlanDaysSchema.default([]),
  /** Grounded plan a correction round is trying to improve on. */
  base: DietPlanSchema.optional(),
  /** Revision instructions for the current pass. */
  instructions: z.string().optional(),
  /** True once a correction round is rebuilding the days. */
  fixing: z.boolean().default(false),
  /** The days a correction round rebuilds — only those that miss their band. */
  fixDays: z.array(z.string()).default([]),
});
type Generation = z.infer<typeof GenerationSchema>;

// Steps in order, for the progress the dietitian watches.
const STEP_LABELS: Record<string, string> = {
  overview: "Setting targets and strategy",
  ground: "Costing every item against the food database",
  settle: "Checking the correction actually helped",
  done: "Finishing up",
};
/** The day batches the current pass walks: the week, or just the bad days. */
const batchesFor = (gen: Generation): string[][] =>
  gen.fixing
    ? Array.from({ length: Math.ceil(gen.fixDays.length / 2) }, (_, i) =>
        gen.fixDays.slice(i * 2, i * 2 + 2)
      )
    : DAY_BATCHES;

const stepLabel = (stage: string, gen: Generation): string => {
  const batch = /^days:(\d+)$/.exec(stage);
  if (batch) {
    const names = batchesFor(gen)[Number(batch[1])] ?? [];
    return `${gen.fixing ? "Correcting" : "Planning"} ${names.join(" and ")}`;
  }
  return STEP_LABELS[stage] ?? "Working";
};
/** Rough completion for a progress bar: 6 steps normally, 11 with a correction. */
const progressOf = (stage: string, gen: Generation): { step: number; total: number } => {
  const order = ["overview", "days:0", "days:1", "days:2", "days:3", "ground"];
  const total =
    gen.fixing || gen.instructions
      ? order.length + Math.ceil(Math.max(1, gen.fixDays.length) / 2) + 1
      : order.length;
  const idx = order.indexOf(stage);
  if (idx >= 0) return { step: gen.fixing ? order.length + idx : idx, total };
  if (stage === "settle") return { step: total - 1, total };
  return { step: total, total };
};

const toNum = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && v !== "" && v !== null ? n : null;
};

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    return body.type === "start"
      ? await start(supabase, user, body)
      : await step(supabase, body.planId);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    console.error(`plan-step ${body.type} failed:`, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

// ---------------------------------------------------------------------------
// start — the only step that creates rows. One model call (the clinical
// review) for a new counselling; none for the others.
// ---------------------------------------------------------------------------

type Supa = ReturnType<typeof createClient>;

async function start(
  supabase: Supa,
  user: { id: string },
  body: Extract<z.infer<typeof BodySchema>, { type: "start" }>
) {
  // ---- Dietitian revision of an existing draft: no new client, no review.
  if (body.source === "revise") {
    const { data: row } = await supabase
      .from("diet_plans")
      .select("id, client_id, week_number, status, plan, starts_on")
      .eq("id", body.planId)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    if (row.status !== "draft") {
      return NextResponse.json({ error: "This plan has already been approved" }, { status: 409 });
    }
    const draft = DietPlanSchema.safeParse(row.plan);
    if (!draft.success) {
      return NextResponse.json(
        { error: "The stored draft is not a valid plan — regenerate it instead" },
        { status: 422 }
      );
    }
    const generation: Generation = {
      pass: "revise",
      days: [],
      base: draft.data,
      instructions: body.instructions,
      fixing: false,
      fixDays: [],
    };
    await supabase
      .from("diet_plans")
      .update({ status: "generating", stage: "overview", generation })
      .eq("id", row.id);
    return NextResponse.json({
      planId: row.id,
      clientId: row.client_id,
      stage: "overview",
      done: false,
      label: stepLabel("overview", generation),
      ...progressOf("overview", generation),
    });
  }

  // ---- New counselling / follow-up / retry: resolve the client and intake.
  let clientId: string;
  let intake: IntakeForm;
  let week: number;
  let source: "first_counselling" | "follow_up";
  let aiReview: AiReview | null = null;

  if (body.source === "first") {
    intake = body.form as unknown as IntakeForm;
    if (!intake.fullName?.trim()) {
      return NextResponse.json({ error: "Client name is required" }, { status: 400 });
    }
    // Mandatory questions are enforced server-side too — the plan may only be
    // generated from a complete counselling.
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
      // Independent clinical review BEFORE anything is persisted — on a pause
      // the counselling stays a draft so the gaps can be addressed.
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
      .select("id")
      .single();
    if (error) throw new Error(`Could not save client: ${error.message}`);
    clientId = client.id;
    week = 1;
    source = "first_counselling";

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
      .select("id, intake")
      .eq("id", clientId)
      .maybeSingle();
    if (error || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    intake = client.intake as IntakeForm;

    const { data: latest } = await supabase
      .from("diet_plans")
      .select("week_number")
      .eq("client_id", clientId)
      .neq("status", "generating")
      .order("week_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (body.source === "followup") {
      const followup = body.followup as unknown as FollowUpInput;
      week = (latest?.week_number ?? 0) + 1;
      source = "follow_up";
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
      if (toNum(followup.weightKg) !== null) {
        await supabase
          .from("clients")
          .update({ weight_kg: toNum(followup.weightKg), updated_at: new Date().toISOString() })
          .eq("id", clientId);
      }
    } else {
      week = latest ? latest.week_number : 1;
      source = latest ? "follow_up" : "first_counselling";
      if (source === "first_counselling") {
        aiReview = await runReview(intake);
        if (aiReview && isPauseDecision(aiReview)) return pauseResponse(aiReview, { clientId });
      }
    }
  }

  // Day 1 is fixed now so the weekday food rules enforced during generation
  // and the PDF's date labels agree.
  const planStart = new Date();
  planStart.setDate(planStart.getDate() + 1);
  const startsOn = planStart.toISOString().slice(0, 10);

  const generation: Generation = { pass: "generate", days: [], fixing: false, fixDays: [] };
  const { data: planRow, error: planError } = await supabase
    .from("diet_plans")
    .insert({
      client_id: clientId,
      dietitian_id: user.id,
      week_number: week,
      source,
      status: "generating",
      stage: "overview",
      starts_on: startsOn,
      plan: {},
      ai_review: aiReview,
      generation,
    })
    .select("id")
    .single();
  if (planError) throw new Error(`Could not start the plan: ${planError.message}`);

  if (body.source === "first") {
    await supabase
      .from("form_drafts")
      .delete()
      .eq("dietitian_id", user.id)
      .eq("kind", "first_counselling");
  }

  return NextResponse.json({
    planId: planRow.id,
    clientId,
    week,
    stage: "overview",
    done: false,
    label: stepLabel("overview", generation),
    ...progressOf("overview", generation),
  });
}

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

// ---------------------------------------------------------------------------
// step — exactly one unit of work, then persist and report what is next.
// ---------------------------------------------------------------------------

async function step(supabase: Supa, planId: string) {
  const { data: row } = await supabase
    .from("diet_plans")
    .select("id, client_id, week_number, source, status, stage, plan, ai_review, starts_on, generation")
    .eq("id", planId)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  if (row.status !== "generating" || !row.stage) {
    // Already finished — treat as success so a duplicate call from a retry or
    // a double-clicked button is harmless.
    return NextResponse.json({ planId, clientId: row.client_id, stage: null, done: true });
  }

  const parsedGen = GenerationSchema.safeParse(row.generation ?? {});
  if (!parsedGen.success) {
    return NextResponse.json(
      { error: "This generation's saved state is unreadable — start it again" },
      { status: 422 }
    );
  }
  const gen = parsedGen.data;
  const stage = row.stage;

  const { data: client } = await supabase
    .from("clients")
    .select("intake")
    .eq("id", row.client_id)
    .maybeSingle();
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  const intake = client.intake as IntakeForm;

  // The context every step reasons over. `revision` is set whenever a pass is
  // correcting or applying instructions, so the model revises rather than
  // inventing a new plan.
  const parsedReview = row.ai_review ? AiReviewSchema.safeParse(row.ai_review) : null;
  const { data: prev } = await supabase
    .from("diet_plans")
    .select("plan")
    .eq("client_id", row.client_id)
    .lt("week_number", row.week_number)
    .neq("status", "generating")
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

  const ctx: PlanContext = {
    intake,
    week: row.week_number,
    previousPlan: parsedPrev?.success ? parsedPrev.data : null,
    followup,
    review: parsedReview?.success ? parsedReview.data : null,
    startsOn: row.starts_on,
    revision:
      gen.base && gen.instructions
        ? { draft: gen.base, instructions: gen.instructions }
        : null,
  };

  /**
   * Persist and advance. The stage guard makes a step idempotent under a
   * double-click: a second call for a stage that already ran updates nothing.
   */
  const advance = async (next: string | null, patch: Record<string, unknown>) => {
    const { error } = await supabase
      .from("diet_plans")
      .update({ ...patch, stage: next })
      .eq("id", planId)
      .eq("stage", stage);
    if (error) throw new Error(`Could not save progress: ${error.message}`);
  };
  const reply = (next: string | null, nextGen: Generation, done = false) =>
    NextResponse.json({
      planId,
      clientId: row.client_id,
      stage: next,
      done,
      label: next ? stepLabel(next, nextGen) : "Ready for review",
      ...progressOf(next ?? "done", nextGen),
    });

  // ---- overview: the plan's strategy and daily targets
  if (stage === "overview") {
    const overview = await generatePlanOverview(ctx);
    const next: Generation = { ...gen, overview, days: [] };
    await advance("days:0", { generation: next });
    return reply("days:0", next);
  }

  // ---- days:N — one batch of days, aware of the ones already built
  const batchMatch = /^days:(\d+)$/.exec(stage);
  if (batchMatch) {
    const index = Number(batchMatch[1]);
    const batches = batchesFor(gen);
    const names = batches[index];
    if (!names || !gen.overview) {
      return NextResponse.json({ error: "This generation lost its place — start it again" }, { status: 422 });
    }
    const built = await generatePlanDays(ctx, gen.overview, names, gen.days);
    const days = [...gen.days, ...built];
    const nextIndex = index + 1;
    const next: Generation = { ...gen, days };
    const nextStage =
      nextIndex < batches.length ? `days:${nextIndex}` : gen.fixing ? "settle" : "ground";
    await advance(nextStage, { generation: next });
    return reply(nextStage, next);
  }

  // ---- ground: no model call. Cost the week, audit it, and decide whether a
  // correction round is warranted.
  if (stage === "ground") {
    if (!gen.overview) {
      return NextResponse.json({ error: "This generation lost its place — start it again" }, { status: 422 });
    }
    const assembled = assemblePlan(ctx, gen.overview, gen.days);
    const plan = await groundSafely(supabase, assembled);
    await audit(supabase, plan);

    // A dietitian's own revision is not second-guessed by the automatic
    // correction — their instructions ARE the correction.
    const need =
      gen.pass === "revise"
        ? { needed: false, instructions: "", reason: "", offTargetDays: [] }
        : reconcileNeed(plan);
    if (!need.needed) {
      const next: Generation = { ...gen, days: [] };
      await advance(null, { plan, status: "draft", generation: {} });
      return reply(null, next, true);
    }
    console.log(`nutrition reconcile needed: ${need.reason}`);
    // Only the days that miss their band — rebuilding the whole week let a
    // correction make good days worse while fixing bad ones.
    const next: Generation = {
      ...gen,
      base: plan,
      instructions: need.instructions,
      fixing: true,
      fixDays: need.offTargetDays,
      days: [],
    };
    await advance("days:0", { plan, generation: next });
    return reply("days:0", next);
  }

  // ---- settle: keep the correction only if it verifiably helped
  if (stage === "settle") {
    if (!gen.overview || !gen.base) {
      return NextResponse.json({ error: "This generation lost its place — start it again" }, { status: 422 });
    }
    let plan = gen.base;
    try {
      // The correction only rebuilt some days; the rest stand as they were.
      const merged = gen.base.days.map(
        (d) => gen.days.find((r) => r.day === d.day) ?? d
      );
      const revised = assemblePlan(ctx, gen.overview, merged);
      const grounded = await groundSafely(supabase, revised);
      const verdict = acceptRevision(gen.base, grounded);
      console.log(`nutrition reconcile ${verdict.accept ? "applied" : "skipped"}: ${verdict.reason}`);
      if (verdict.accept) plan = grounded;
    } catch (e) {
      // A correction that cannot be built or verified is simply not applied.
      console.warn("nutrition reconcile skipped:", e instanceof Error ? e.message : e);
    }
    const next: Generation = { ...gen, days: [] };
    await advance(null, { plan, status: "draft", generation: {} });
    return reply(null, next, true);
  }

  return NextResponse.json({ error: `Unknown generation step "${stage}"` }, { status: 422 });
}

/** Grounding is never fatal: an unseeded foods table keeps model estimates. */
async function groundSafely(supabase: Supa, plan: DietPlan): Promise<DietPlan> {
  try {
    const { plan: grounded, stats } = await groundPlan(supabase, plan);
    console.log(
      `nutrition grounding: ${stats.grounded_meals}/${stats.total_meals} meals, ` +
        `${stats.matched_items}/${stats.total_items} items`
    );
    return grounded;
  } catch (e) {
    console.warn("nutrition grounding skipped:", e instanceof Error ? e.message : e);
    return plan;
  }
}

/** Observational only — a recurring name here means staples.json is missing one. */
async function audit(supabase: Supa, plan: DietPlan) {
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
  } catch (e) {
    console.warn("match audit skipped:", e instanceof Error ? e.message : e);
  }
}

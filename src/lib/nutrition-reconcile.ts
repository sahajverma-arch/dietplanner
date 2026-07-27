import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generatePlanDays,
  type DietPlan,
  type PlanContext,
  type PlanOverview,
} from "./nim";

// Days rebuilt per model call. Same reasoning as generation: a small response
// is faster and truncates less, and it has to fit one request on a 60s host.
const REBUILD_BATCH = 2;
import { groundPlan } from "./nutrition";
import {
  bandsFor,
  dayCalories,
  dayProtein,
  type DayBands,
} from "./day-targets";

// ---------------------------------------------------------------------------
// Post-grounding nutrition reconciliation.
//
// The model reliably *claims* the calorie and protein targets in its estimates,
// but honest database grounding reveals days that miss them in BOTH directions:
// vegetarian days 5-15 g short on protein, dal-and-roti dinners leaving a day
// 20%+ under target, and — the direction the old top-up ignored entirely —
// weight-loss plans running 8-28% OVER target every single day, which is a
// clinical problem, not a rounding error.
//
// One corrective revision round runs with day-specific instructions; the result
// is re-grounded and kept only if the verified deviation shrank. Exactly one
// round, deliberately: a revision is a full two-call regeneration (~90-150 s)
// and the route it runs in is capped at maxDuration = 300 s. Never fatal —
// callers keep the original plan on any error.
// ---------------------------------------------------------------------------

// The protein floor and calorie band live in day-targets.ts, shared with the
// draft preview so the badge a dietitian sees and the rule this pass enforces
// can never drift apart.
//
// No day of a revision may exceed this multiple of the target, whatever the
// deviation score says — a revision once smuggled 2823 kcal days past an
// average-only gate on a weight-loss plan.
const CALORIE_HARD_CEILING = 1.2;

/**
 * Total distance from target across the week, on one kcal scale (protein grams
 * weighted at 4 kcal/g). Counts calorie shortfall AND calorie excess, so a
 * revision that fixes a light day by making another day heavy scores no better
 * than the plan it replaced.
 */
function deviationScore(plan: DietPlan, b: DayBands): number {
  return plan.days.reduce((s, d) => {
    const kcal = dayCalories(d);
    return (
      s +
      4 * Math.max(0, b.lowP - dayProtein(d)) +
      Math.max(0, b.lowCal - kcal) +
      Math.max(0, kcal - b.highCal)
    );
  }, 0);
}

export interface ReconcileResult {
  plan: DietPlan;
  applied: boolean;
  /** Human-readable outcome for logs ("deviation 620 -> 90 over 3 day(s)"). */
  reason: string;
}

/** What a correction round should ask for, decided without any model call. */
export interface ReconcileNeed {
  needed: boolean;
  /** Revision instructions naming each off-target day; "" when not needed. */
  instructions: string;
  reason: string;
  /** Day names that miss their band — the only days worth rebuilding. */
  offTargetDays: string[];
}

/**
 * Whether this grounded plan needs a portion correction, and what to ask for.
 * Pure, so the stepped API can decide in one request and spend the model calls
 * in the next ones — the same decision the one-shot path makes inline.
 */
export function reconcileNeed(plan: DietPlan): ReconcileNeed {
  const proteinTarget = plan.macros?.protein_g ?? 0;
  const calorieTarget = plan.daily_calories ?? 0;
  const hasProtein = Number.isFinite(proteinTarget) && proteinTarget > 0;
  const hasCalories = Number.isFinite(calorieTarget) && calorieTarget > 0;
  if (!hasProtein && !hasCalories) {
    return { needed: false, instructions: "", reason: "no targets on plan", offTargetDays: [] };
  }
  const bands = bandsFor(plan);

  const offTarget = plan.days
    .map((day) => ({ day, protein: dayProtein(day), calories: dayCalories(day) }))
    .filter(
      (x) => x.protein < bands.lowP || x.calories < bands.lowCal || x.calories > bands.highCal
    );
  if (offTarget.length === 0) {
    return {
      needed: false,
      instructions: "",
      reason: "all days within protein band and calorie band",
      offTargetDays: [],
    };
  }

  const lines = offTarget.map(({ day, protein, calories }) => {
    const gaps: string[] = [];
    if (protein < bands.lowP) {
      const weakest = [...day.meals]
        .sort((a, b) => (a.protein_g || 0) - (b.protein_g || 0))
        .slice(0, 2)
        .map((m) => `${m.name} (${Math.round(m.protein_g || 0)} g)`)
        .join(" and ");
      gaps.push(
        `${Math.round(protein)} g protein (${Math.round(
          proteinTarget - protein
        )} g short — strengthen ${weakest})`
      );
    }
    if (calories < bands.lowCal) {
      gaps.push(
        `${Math.round(calories)} kcal (${Math.round(
          calorieTarget - calories
        )} kcal SHORT — enlarge main-meal portions to realistic sizes: a full katori of dal is 150-200 g, adequate rice/roti, or add a substantial snack the client accepts)`
      );
    } else if (calories > bands.highCal) {
      // Trimming must not undo the protein target, so name the levers: fats
      // and refined carbs come down first, protein foods stay.
      gaps.push(
        `${Math.round(calories)} kcal (${Math.round(
          calories - calorieTarget
        )} kcal OVER — reduce the most energy-dense portions: cooking oil/ghee, fried items, nuts, and rice/roti quantity. Do NOT cut protein foods (dal, curd, paneer, eggs, chicken) to achieve this)`
      );
    }
    return `- ${day.day}: ${gaps.join("; ")}.`;
  });

  const instructions =
    `AUTOMATIC PORTION CORRECTION (totals below are database-verified, not estimates):\n` +
    `Daily targets: ${hasCalories ? `~${Math.round(calorieTarget)} kcal` : ""}${
      hasCalories && hasProtein ? ", " : ""
    }${hasProtein ? `${Math.round(proteinTarget)} g protein` : ""}. These days miss them:\n` +
    `${lines.join("\n")}\n` +
    `Fix ONLY the listed days, using genuine foods the client accepts ` +
    `(protein: curd, milk, paneer, tofu, soya, eggs, chicken as diet allows). ` +
    `Every day must land within 10% of the calorie target — days marked SHORT must come up, ` +
    `days marked OVER must come down. Do not alter days that already meet the targets, ` +
    `keep every meal's calories consistent with its macros, and use realistic portions — ` +
    `do not inflate or deflate numbers to hit a total.`;

  return {
    needed: true,
    instructions,
    reason: `${offTarget.length} day(s) off target`,
    offTargetDays: offTarget.map((x) => x.day.day),
  };
}

/**
 * Whether a re-grounded correction is actually better than what it replaces.
 * Pure, and shared by both paths so a stepped generation can never keep a
 * revision the one-shot path would have rejected.
 */
export function acceptRevision(
  original: DietPlan,
  groundedRevision: DietPlan
): { accept: boolean; reason: string } {
  const calorieTarget = original.daily_calories ?? 0;
  const hasCalories = Number.isFinite(calorieTarget) && calorieTarget > 0;
  const bands = bandsFor(original);

  const before = deviationScore(original, bands);
  const after = deviationScore(groundedRevision, bands);
  // The ceiling stops a revision SMUGGLING IN a blowout; it must not demand the
  // revision fix a breach the draft already had. Holding it to the absolute
  // ceiling rejected a revision that had genuinely improved (deviation
  // 2105 -> 1986) because the draft was over the ceiling to begin with, and
  // kept the worse plan. So the bar is the ceiling OR the draft's own worst
  // day, whichever is higher.
  const worstDay = (p: DietPlan) => Math.max(...p.days.map(dayCalories));
  const ceilingOk =
    !hasCalories ||
    worstDay(groundedRevision) <= Math.max(calorieTarget * CALORIE_HARD_CEILING, worstDay(original));

  if (after < before && ceilingOk) {
    return { accept: true, reason: `deviation ${Math.round(before)} -> ${Math.round(after)}` };
  }
  const avgKcal =
    groundedRevision.days.reduce((s, d) => s + dayCalories(d), 0) / groundedRevision.days.length;
  return {
    accept: false,
    reason: `revision rejected (deviation ${Math.round(before)} -> ${Math.round(after)}${
      ceilingOk ? "" : ", a day exceeded the calorie ceiling"
    }, avg ${Math.round(avgKcal)} kcal vs target ${Math.round(calorieTarget)})`,
  };
}
export async function reconcileNutrition(
  supabase: SupabaseClient,
  plan: DietPlan,
  ctx: Omit<PlanContext, "revision">
): Promise<ReconcileResult> {
  const need = reconcileNeed(plan);
  if (!need.needed) return { plan, applied: false, reason: need.reason };

  // Rebuild ONLY the days that miss their band, keeping the ones that already
  // land. Regenerating the whole week meant a correction could — and did — make
  // good days worse while fixing bad ones, so the verified deviation grew and
  // the whole round was thrown away: 1303 -> 2102 on a week where three days
  // needed help and four did not.
  const overview = { ...plan, days: undefined } as unknown as PlanOverview;
  const kept = plan.days.filter((d) => !need.offTargetDays.includes(d.day));
  const rebuilt: DietPlan["days"] = [];
  for (let i = 0; i < need.offTargetDays.length; i += REBUILD_BATCH) {
    const names = need.offTargetDays.slice(i, i + REBUILD_BATCH);
    rebuilt.push(
      ...(await generatePlanDays(
        { ...ctx, revision: { draft: plan, instructions: need.instructions } },
        overview,
        names,
        [...kept, ...rebuilt]
      ))
    );
  }
  const merged = plan.days.map((d) => rebuilt.find((r) => r.day === d.day) ?? d);

  // If grounding throws, the revision is unverifiable — the caller's catch
  // keeps the original plan.
  const { plan: grounded } = await groundPlan(supabase, { ...plan, days: merged });

  const verdict = acceptRevision(plan, grounded);
  return verdict.accept
    ? { plan: grounded, applied: true, reason: `${verdict.reason} over ${need.reason}` }
    : { plan, applied: false, reason: verdict.reason };
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateDietPlan, type DietPlan, type PlanContext } from "./nim";
import { groundPlan } from "./nutrition";

// ---------------------------------------------------------------------------
// Post-grounding nutrition top-up.
//
// The model reliably *claims* the calorie and protein targets in its
// estimates, but honest database grounding often reveals under-portioned days:
// vegetarian days 5-15 g short on protein, dal-and-roti dinners leaving a day
// 20%+ under its calorie target. When grounded days fall below the protein
// band or more than 15% under the calorie target, one corrective revision
// round runs with day-specific instructions; the result is re-grounded and
// kept only if the verified combined shortfall decreased without pushing
// average calories off target. Never fatal — callers keep the original plan
// on any error.
// ---------------------------------------------------------------------------

// A day is protein-deficient when its grounded protein is below target minus this.
const PROTEIN_LOW_TOLERANCE_G = 5;
// A day is calorie-deficient when grounded calories fall below this fraction
// of the daily target.
const CALORIE_LOW_FRACTION = 0.85;
// The revised week's average calories must stay within this fraction of the
// daily target, so gaps aren't closed with a blowout.
const CALORIE_TOLERANCE = 0.2;

type PlanDay = DietPlan["days"][number];

const dayProtein = (d: PlanDay) => d.meals.reduce((s, m) => s + (m.protein_g || 0), 0);
const dayCalories = (d: PlanDay) => d.meals.reduce((s, m) => s + (m.calories || 0), 0);

// Combined shortfall on one kcal scale (protein grams weighted at 4 kcal/g),
// so "protein improved, calories untouched" and vice versa both count.
function shortfallScore(plan: DietPlan, lowP: number, lowCal: number): number {
  return plan.days.reduce(
    (s, d) =>
      s + 4 * Math.max(0, lowP - dayProtein(d)) + Math.max(0, lowCal - dayCalories(d)),
    0
  );
}

export interface TopUpResult {
  plan: DietPlan;
  applied: boolean;
  /** Human-readable outcome for logs ("shortfall 620 -> 90 over 3 day(s)"). */
  reason: string;
}

export async function nutritionTopUp(
  supabase: SupabaseClient,
  plan: DietPlan,
  ctx: Omit<PlanContext, "revision">
): Promise<TopUpResult> {
  const proteinTarget = plan.macros?.protein_g ?? 0;
  const calorieTarget = plan.daily_calories ?? 0;
  const hasProtein = Number.isFinite(proteinTarget) && proteinTarget > 0;
  const hasCalories = Number.isFinite(calorieTarget) && calorieTarget > 0;
  if (!hasProtein && !hasCalories) {
    return { plan, applied: false, reason: "no targets on plan" };
  }
  const lowP = hasProtein ? proteinTarget - PROTEIN_LOW_TOLERANCE_G : 0;
  const lowCal = hasCalories ? calorieTarget * CALORIE_LOW_FRACTION : 0;

  const deficient = plan.days
    .map((day) => ({ day, protein: dayProtein(day), calories: dayCalories(day) }))
    .filter((x) => x.protein < lowP || x.calories < lowCal);
  if (deficient.length === 0) {
    return { plan, applied: false, reason: "all days within protein band and calorie floor" };
  }

  const lines = deficient.map(({ day, protein, calories }) => {
    const gaps: string[] = [];
    if (protein < lowP) {
      const weakest = [...day.meals]
        .sort((a, b) => (a.protein_g || 0) - (b.protein_g || 0))
        .slice(0, 2)
        .map((m) => `${m.name} (${Math.round(m.protein_g || 0)} g)`)
        .join(" and ");
      gaps.push(
        `${Math.round(protein)} g protein (${Math.round(proteinTarget - protein)} g short — strengthen ${weakest})`
      );
    }
    if (calories < lowCal) {
      gaps.push(
        `${Math.round(calories)} kcal (${Math.round(calorieTarget - calories)} kcal short — enlarge main-meal portions to realistic sizes: a full katori of dal is 150-200 g, adequate rice/roti, or add a substantial snack the client accepts)`
      );
    }
    return `- ${day.day}: ${gaps.join("; ")}.`;
  });

  const instructions =
    `AUTOMATIC PORTION CORRECTION (totals below are database-verified):\n` +
    `Daily targets: ${hasCalories ? `~${Math.round(calorieTarget)} kcal` : ""}${
      hasCalories && hasProtein ? ", " : ""
    }${hasProtein ? `${Math.round(proteinTarget)} g protein` : ""}. These days fall short:\n` +
    `${lines.join("\n")}\n` +
    `Fix ONLY the listed days by adding or enlarging genuine foods the client accepts ` +
    `(protein: curd, milk, paneer, tofu, soya, eggs, chicken as diet allows; calories: honest portion sizes). ` +
    `Do not alter days that already meet the targets, keep every meal's calories consistent with its macros, ` +
    `and use realistic portions — do not inflate numbers.`;

  const revised = await generateDietPlan({ ...ctx, revision: { draft: plan, instructions } });
  // If grounding throws, the revision is unverifiable — the caller's catch
  // keeps the original plan.
  const { plan: grounded } = await groundPlan(supabase, revised);

  const before = shortfallScore(plan, lowP, lowCal);
  const after = shortfallScore(grounded, lowP, lowCal);
  const avgKcal = grounded.days.reduce((s, d) => s + dayCalories(d), 0) / grounded.days.length;
  // Only overshoot is gated here: undershoot is exactly what the shortfall
  // score measures, and rejecting an improving-but-still-light revision would
  // freeze a deeply under-portioned plan at its worst (seen at 850 kcal/day
  // against a 1550 target). Every single day is checked, not just the weekly
  // average — a revision once smuggled 2823 kcal days past an average-only
  // gate on a weight-loss plan.
  const calorieOk =
    !hasCalories ||
    grounded.days.every((d) => dayCalories(d) <= calorieTarget * (1 + CALORIE_TOLERANCE));

  if (after < before && calorieOk) {
    return {
      plan: grounded,
      applied: true,
      reason: `shortfall score ${Math.round(before)} -> ${Math.round(after)} over ${deficient.length} day(s)`,
    };
  }
  return {
    plan,
    applied: false,
    reason: `revision rejected (shortfall score ${Math.round(before)} -> ${Math.round(after)}, avg ${Math.round(
      avgKcal
    )} kcal vs target ${Math.round(calorieTarget)})`,
  };
}

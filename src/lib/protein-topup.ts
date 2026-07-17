import type { SupabaseClient } from "@supabase/supabase-js";
import { generateDietPlan, type DietPlan, type PlanContext } from "./nim";
import { groundPlan } from "./nutrition";

// ---------------------------------------------------------------------------
// Post-grounding protein top-up.
//
// The model reliably *claims* the protein target in its estimates, but honest
// database grounding often lands vegetarian days 5-15 g under it (dal-heavy
// dinners, fruit-only snacks). When grounded days fall below the band, one
// corrective revision round runs with day-specific instructions; the result is
// re-grounded and kept only if the verified shortfall actually decreased
// without pushing calories off target. Never fatal — callers keep the
// original plan on any error.
// ---------------------------------------------------------------------------

// A day is deficient when its grounded protein is below target minus this.
const PROTEIN_LOW_TOLERANCE_G = 5;
// The revised week's average calories must stay within this fraction of the
// daily target, so protein isn't bought with a calorie blowout.
const CALORIE_TOLERANCE = 0.2;

type PlanDay = DietPlan["days"][number];

const dayProtein = (d: PlanDay) => d.meals.reduce((s, m) => s + (m.protein_g || 0), 0);
const dayCalories = (d: PlanDay) => d.meals.reduce((s, m) => s + (m.calories || 0), 0);

const shortfall = (plan: DietPlan, low: number) =>
  plan.days.reduce((s, d) => s + Math.max(0, low - dayProtein(d)), 0);

export interface TopUpResult {
  plan: DietPlan;
  applied: boolean;
  /** Human-readable outcome for logs ("shortfall 21g -> 4g over 3 day(s)"). */
  reason: string;
}

export async function proteinTopUp(
  supabase: SupabaseClient,
  plan: DietPlan,
  ctx: Omit<PlanContext, "revision">
): Promise<TopUpResult> {
  const target = plan.macros?.protein_g ?? 0;
  if (!Number.isFinite(target) || target <= 0) {
    return { plan, applied: false, reason: "no protein target on plan" };
  }
  const low = target - PROTEIN_LOW_TOLERANCE_G;

  const deficient = plan.days
    .map((day) => ({ day, protein: dayProtein(day) }))
    .filter((x) => x.protein < low);
  if (deficient.length === 0) {
    return { plan, applied: false, reason: "all days within protein band" };
  }

  const lines = deficient.map(({ day, protein }) => {
    const weakest = [...day.meals]
      .sort((a, b) => (a.protein_g || 0) - (b.protein_g || 0))
      .slice(0, 2)
      .map((m) => `${m.name} (${Math.round(m.protein_g || 0)} g)`)
      .join(" and ");
    return `- ${day.day}: ${Math.round(protein)} g protein, ${Math.round(
      target - protein
    )} g short. Strengthen its weakest meals: ${weakest}.`;
  });

  const instructions =
    `AUTOMATIC PROTEIN CORRECTION (totals below are database-verified):\n` +
    `The daily protein target is ${Math.round(target)} g but these days fall short:\n` +
    `${lines.join("\n")}\n` +
    `Raise ONLY the listed days to ${Math.round(low)}-${Math.round(
      target + PROTEIN_LOW_TOLERANCE_G
    )} g by adding or enlarging genuine protein foods the client accepts ` +
    `(curd, milk, paneer, tofu, soya chunks, besan chilla, dal portions, sprouts) in their weakest meals. ` +
    `Do not alter days that already meet the target. Keep each day's calories near ${Math.round(
      plan.daily_calories
    )} kcal, keep every meal's calories consistent with its macros, and use realistic portions — ` +
    `do not inflate numbers.`;

  const revised = await generateDietPlan({ ...ctx, revision: { draft: plan, instructions } });
  // If grounding throws, the revision is unverifiable — the caller's catch
  // keeps the original plan.
  const { plan: grounded } = await groundPlan(supabase, revised);

  const before = shortfall(plan, low);
  const after = shortfall(grounded, low);
  const kcalTarget = plan.daily_calories;
  const avgKcal = grounded.days.reduce((s, d) => s + dayCalories(d), 0) / grounded.days.length;
  const calorieOk =
    !Number.isFinite(kcalTarget) ||
    kcalTarget <= 0 ||
    Math.abs(avgKcal - kcalTarget) / kcalTarget <= CALORIE_TOLERANCE;

  if (after < before && calorieOk) {
    return {
      plan: grounded,
      applied: true,
      reason: `shortfall ${Math.round(before)}g -> ${Math.round(after)}g over ${deficient.length} day(s)`,
    };
  }
  return {
    plan,
    applied: false,
    reason: `revision rejected (shortfall ${Math.round(before)}g -> ${Math.round(after)}g, avg ${Math.round(
      avgKcal
    )} kcal vs target ${Math.round(kcalTarget)})`,
  };
}

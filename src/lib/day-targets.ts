import type { DietPlan } from "./nim";

// ---------------------------------------------------------------------------
// One definition of "this day misses its target", shared by the server-side
// reconciliation pass (src/lib/nutrition-reconcile.ts) and the draft preview
// the dietitian reviews (src/components/PlanView.tsx). Kept in its own module
// with type-only imports so the UI can use it without pulling the NIM client
// into the bundle — and so the badge a dietitian sees can never disagree with
// the rule the corrective pass applied.
// ---------------------------------------------------------------------------

// A day is protein-deficient when its grounded protein is below target minus
// this. There is no upper protein band: extra protein is never the complaint.
export const PROTEIN_LOW_TOLERANCE_G = 5;
// Calorie band around the daily target. Outside it, the day is off target.
export const CALORIE_LOW_FRACTION = 0.85;
export const CALORIE_HIGH_FRACTION = 1.15;

type PlanDay = DietPlan["days"][number];

/** Summed from the meals, never from the stored total, which can be stale. */
export const dayProtein = (d: PlanDay) => d.meals.reduce((s, m) => s + (m.protein_g || 0), 0);
export const dayCalories = (d: PlanDay) => d.meals.reduce((s, m) => s + (m.calories || 0), 0);

export interface DayBands {
  lowP: number;
  lowCal: number;
  highCal: number;
}

export function bandsFor(plan: DietPlan): DayBands {
  const proteinTarget = plan.macros?.protein_g ?? 0;
  const calorieTarget = plan.daily_calories ?? 0;
  const hasProtein = Number.isFinite(proteinTarget) && proteinTarget > 0;
  const hasCalories = Number.isFinite(calorieTarget) && calorieTarget > 0;
  return {
    lowP: hasProtein ? proteinTarget - PROTEIN_LOW_TOLERANCE_G : 0,
    lowCal: hasCalories ? calorieTarget * CALORIE_LOW_FRACTION : 0,
    // Without a calorie target nothing can be "over" — Infinity keeps the
    // excess term at zero instead of measuring every day against 0 kcal.
    highCal: hasCalories ? calorieTarget * CALORIE_HIGH_FRACTION : Infinity,
  };
}

/**
 * Short label for how a day misses its targets, or null when it is on target.
 * Calories are reported first: a day that is both light and low on protein is
 * fixed by enlarging portions, which is the calorie instruction anyway.
 */
export function dayTargetVerdict(day: PlanDay, plan: DietPlan): string | null {
  const b = bandsFor(plan);
  const kcal = dayCalories(day);
  if (kcal > 0 && kcal < b.lowCal) return `${Math.round(plan.daily_calories - kcal)} kcal under`;
  if (kcal > b.highCal) return `${Math.round(kcal - plan.daily_calories)} kcal over`;
  const protein = dayProtein(day);
  if (protein > 0 && protein < b.lowP) {
    return `${Math.round((plan.macros?.protein_g ?? 0) - protein)} g protein short`;
  }
  return null;
}

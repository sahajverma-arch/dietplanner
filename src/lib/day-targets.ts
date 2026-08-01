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
// this.
export const PROTEIN_LOW_TOLERANCE_G = 5;
// And over-supplied above target times this.
//
// There used to be no upper band, on the reasoning that extra protein is never
// the complaint. It is, when the target was MEASURED: a client eating 70 g/day
// has a week-1 target of 79 g precisely so the step is one they can keep, and
// a plan delivering 101-125 g hands them the 45%-overnight jump the whole
// progression exists to avoid. Generous enough that a naturally protein-rich
// day passes; tight enough that a plan ignoring the target does not.
export const PROTEIN_HIGH_FRACTION = 1.25;
// Calorie band around the daily target. Outside it, the day is off target.
export const CALORIE_LOW_FRACTION = 0.85;
export const CALORIE_HIGH_FRACTION = 1.15;

// A target on its own reads as "at least", and an Indian vegetarian day of
// roti + dal + curd + paneer lands near 76 g without trying. So the prompt and
// the correction instructions both state a ceiling and a per-meal split, and
// they take those numbers from here so the two can never quote different ones.
//
// The stated ceiling is deliberately TIGHTER than PROTEIN_HIGH_FRACTION, which
// is what actually fails a day: aiming at 1.1x and failing at 1.25x leaves room
// for honest portion variance without inviting a drift to the failure line.
export const PROTEIN_CEILING_FRACTION = 1.1;
export const proteinCeiling = (targetG: number) => Math.round(targetG * PROTEIN_CEILING_FRACTION);

// Three main meals carry ~27% each and two snacks ~9% each, which sums to the
// target. Composing one meal against a daily figure is guesswork; composing it
// against "about 15 g here" is not.
export const perMainMeal = (targetG: number) => Math.round(targetG * 0.27);
export const perSnack = (targetG: number) => Math.round(targetG * 0.09);

type PlanDay = DietPlan["days"][number];

/** Summed from the meals, never from the stored total, which can be stale. */
export const dayProtein = (d: PlanDay) => d.meals.reduce((s, m) => s + (m.protein_g || 0), 0);
export const dayCalories = (d: PlanDay) => d.meals.reduce((s, m) => s + (m.calories || 0), 0);

export interface DayBands {
  lowP: number;
  highP: number;
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
    // Infinity without a target, so the excess term stays at zero rather than
    // measuring every day against 0 g — same reasoning as highCal.
    highP: hasProtein ? proteinTarget * PROTEIN_HIGH_FRACTION : Infinity,
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
  const target = plan.macros?.protein_g ?? 0;
  if (protein > 0 && protein < b.lowP) {
    return `${Math.round(target - protein)} g protein short`;
  }
  if (protein > b.highP) return `${Math.round(protein - target)} g protein over`;
  return null;
}

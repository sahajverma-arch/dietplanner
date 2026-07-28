// Resting and total energy, derived from what the counselling already records.
//
// Shown to the client during the review that closes the consultation: this is
// where "how much do you eat now, and what are we planning" becomes a number
// they can see rather than a claim they have to take on trust.
//
// These are ESTIMATES from population equations, not measurements. Mifflin-St
// Jeor is the usual clinical default and is still ±10% for any individual, so
// the review labels them as estimates and the dietitian can overrule anything
// downstream. Nothing here sets the plan's calorie target — the model does that
// from the full clinical picture — but a TDEE the dietitian can see makes an
// implausible target obvious before a client ever receives it.

import type { Answers } from "./questions";

const val = (a: Answers, id: string): string => {
  const v = a[id];
  return typeof v === "string" ? v : "";
};
const num = (a: Answers, id: string): number | null => {
  const n = Number(val(a, id));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * Everyday movement outside planned exercise, as a share of BMR.
 *
 * The low end of the usual 1.2-1.9 range: training is counted separately below,
 * so this multiplier must describe the REST of the day. Using a full
 * "very active" 1.9 here and then adding training on top double-counts the gym.
 */
const NEAT_FACTOR: Record<string, number> = {
  "Mostly seated": 1.2,
  "Lightly active": 1.35,
  "Moderately active": 1.45,
  Active: 1.55,
  "Highly physical": 1.7,
};

/** Roughly what a training session adds per day, averaged across the week. */
const KCAL_PER_SESSION = 250;

export interface EnergyEstimate {
  /** Resting energy, Mifflin-St Jeor. Null when height/weight/age/sex missing. */
  bmr: number | null;
  /** BMR x everyday movement, plus training averaged over the week. */
  tdee: number | null;
  /** BMI, or null without height and weight. */
  bmi: number | null;
  /** The NEAT multiplier used, so the review can show its working. */
  activityFactor: number | null;
  /** Training days a week that were counted. */
  trainingDays: number;
  /** What the equation could not be given. */
  missing: string[];
}

/**
 * Mifflin-St Jeor:
 *   men   10w + 6.25h - 5a + 5
 *   women 10w + 6.25h - 5a - 161
 *
 * Sex is required and has no neutral form in the equation. Rather than pick one
 * silently for a client who did not say — which would bias every number that
 * follows — this returns null and the review shows what is missing.
 */
export function energyEstimate(a: Answers): EnergyEstimate {
  const weight = num(a, "q9_weight");
  const height = num(a, "q9_height");
  const age = num(a, "q9_age");
  const sex = val(a, "gender").trim().toLowerCase();

  const missing: string[] = [];
  if (!weight) missing.push("weight");
  if (!height) missing.push("height");
  if (!age) missing.push("age");
  if (sex !== "male" && sex !== "female") missing.push("sex");

  const bmi = weight && height ? weight / (height / 100) ** 2 : null;

  if (!weight || !height || !age || (sex !== "male" && sex !== "female")) {
    return { bmr: null, tdee: null, bmi, activityFactor: null, trainingDays: 0, missing };
  }

  const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === "male" ? 5 : -161);

  const activityFactor = NEAT_FACTOR[val(a, "q54c")] ?? 1.2;
  const days = Number(val(a, "q44a"));
  const trainingDays = Number.isFinite(days) ? Math.min(7, Math.max(0, days)) : 0;
  const tdee = bmr * activityFactor + (trainingDays * KCAL_PER_SESSION) / 7;

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    bmi,
    activityFactor,
    trainingDays,
    missing,
  };
}

/** The clinical band for a BMI, on Asian-Indian cut-offs. */
export function bmiBand(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 23) return "Healthy";
  if (bmi < 25) return "Overweight";
  if (bmi < 30) return "Obese I";
  return "Obese II";
}

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
export const NEAT_FACTOR: Record<string, number> = {
  "Mostly seated": 1.2,
  "Lightly active": 1.35,
  "Moderately active": 1.45,
  Active: 1.55,
  "Highly physical": 1.7,
};

/**
 * Compendium-of-Physical-Activities-style MET values, by reported session
 * intensity (q44e). A session's calorie cost is not flat by day count — a
 * 25-minute yoga class and a 90-minute heavy-lifting session used to both
 * count as 250 kcal, rewarding frequency over effort. See
 * scripts/activity-energy-proposal-pdf.tsx for the full case; this is Rule 2
 * from that proposal. "Variable", "Not sure" and no answer all fall through
 * to the default below.
 */
export const INTENSITY_MET: Record<string, number> = {
  "Very light": 2.5,
  Light: 3.0,
  Moderate: 5.0,
  Hard: 7.0,
  "Very hard": 9.0,
};
const INTENSITY_MET_DEFAULT = INTENSITY_MET.Light;

/** Midpoint of each reported session-duration band (q44b), in hours. */
export const DURATION_H: Record<string, number> = {
  "Less than 30 minutes": 0.375,
  "30–45 minutes": 0.625,
  "45–60 minutes": 0.875,
  "60–90 minutes": 1.25,
  "More than 90 minutes": 1.75,
};
const DURATION_H_DEFAULT = DURATION_H["30–45 minutes"];

/**
 * Thermic effect of food (diet-induced thermogenesis): digesting, absorbing
 * and metabolising what's eaten is itself energy work. It runs 20-30% of a
 * protein calorie, 5-10% of a carb calorie and 0-3% of a fat calorie — on an
 * ordinary mixed plate that averages out close to a tenth of everything
 * eaten, so a flat 10% is the standard shorthand absent a meal-by-meal macro
 * breakdown to compute it exactly.
 *
 * Costed as 10% of the NEAT- and training-adjusted total (BMR x activity,
 * plus training) — the "TDEE calculated" figure before TEF is added — not of
 * BMR alone. Added on top of that figure, not solved as a share of the final
 * number: TEF = 10% x (BMR x activity + training), then TDEE = that total
 * plus TEF.
 */
export const TEF_SHARE = 0.1;

/**
 * kcal per session = (MET - 1) x body weight kg x hours.
 *
 * The -1 is the resting hour already inside BMR x NEAT — counting the gross
 * MET figure bills that hour twice and inflates every trainer's allowance by
 * roughly 60-90 kcal a day.
 */
export function kcalPerSession(weightKg: number, intensity: string, duration: string): number {
  const met = INTENSITY_MET[intensity] ?? INTENSITY_MET_DEFAULT;
  const hours = DURATION_H[duration] ?? DURATION_H_DEFAULT;
  return Math.round((met - 1) * weightKg * hours);
}

export interface EnergyEstimate {
  /** Resting energy, Mifflin-St Jeor. Null when height/weight/age/sex missing. */
  bmr: number | null;
  /** BMR x everyday movement, plus training averaged over the week, plus TEF. */
  tdee: number | null;
  /** The thermic-effect-of-food slice folded into `tdee` above — 10% of the activity+training total. */
  tefKcal: number | null;
  /** BMI, or null without height and weight. */
  bmi: number | null;
  /** The NEAT multiplier used, so the review can show its working. */
  activityFactor: number | null;
  /** kcal a single training session adds, from its intensity, duration and body weight. */
  kcalPerSession: number;
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
    return {
      bmr: null,
      tdee: null,
      tefKcal: null,
      bmi,
      activityFactor: null,
      kcalPerSession: 0,
      trainingDays: 0,
      missing,
    };
  }

  const bmr = 10 * weight + 6.25 * height - 5 * age + (sex === "male" ? 5 : -161);

  const activityFactor = NEAT_FACTOR[val(a, "q54c")] ?? 1.2;
  const days = Number(val(a, "q44a"));
  const trainingDays = Number.isFinite(days) ? Math.min(7, Math.max(0, days)) : 0;
  const perSession = kcalPerSession(weight, val(a, "q44e"), val(a, "q44b"));
  const activityAndTraining = bmr * activityFactor + (trainingDays * perSession) / 7;
  const tefKcal = activityAndTraining * TEF_SHARE;
  const tdee = activityAndTraining + tefKcal;

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    tefKcal: Math.round(tefKcal),
    bmi,
    activityFactor,
    kcalPerSession: perSession,
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

// The coach's physical assessment: six tests, each scored 1-4, so 24 in total.
//
// Run in person — the coach puts the client through plank, push-ups, a balance
// hold, a reach test, body composition and a ten-minute cardio piece, and marks
// what they see. It is deliberately optional: nothing here blocks a diet plan,
// and a client counselled today may not be assessed until a coach sees them.
//
// Points are DERIVED from the measurement wherever there is one, because a
// coach counting push-ups should not also have to remember that 26 of them is
// three points. The explicit points answer stays as an override for the tests
// with no number (the reach test) and for any occasion where the coach
// disagrees with the table.

import type { Answers } from "./questions";

const val = (a: Answers, id: string): string => {
  const v = a[id];
  return typeof v === "string" ? v : "";
};
const num = (a: Answers, id: string): number | null => {
  const n = Number(val(a, id));
  return Number.isFinite(n) && val(a, id).trim() !== "" ? n : null;
};

export type FitnessPoints = 1 | 2 | 3 | 4;

export interface FitnessTest {
  key: string;
  /** What the coach sees on the report. */
  label: string;
  /** Points 1-4, or null when the test has not been done. */
  points: FitnessPoints | null;
  /** The measurement it was derived from, for the report line. */
  measured: string;
  /** True when the coach set the points by hand rather than by measurement. */
  overridden: boolean;
}

/** Answer ids, kept together so the questions and the scoring cannot drift. */
export const FITNESS_IDS = {
  plankSeconds: "q120_plank_seconds",
  plankPoints: "q120_plank_points",
  pushupsCount: "q120_pushups_count",
  pushupsPoints: "q120_pushups_points",
  balanceSeconds: "q120_balance_seconds",
  balancePoints: "q120_balance_points",
  reachPoints: "q120_reach_points",
  bcaPoints: "q120_bca_points",
  cardioKm: "q120_cardio_km",
  cardioPoints: "q120_cardio_points",
  /** Set when the assessment was carried out — it need not be the counselling. */
  assessedOn: "q120_assessed_on",
} as const;

const clamp = (n: number): FitnessPoints => Math.min(4, Math.max(1, n)) as FitnessPoints;

/** Every 30 seconds is a point, capped at 4. Used by plank and balance. */
const pointsPerHalfMinute = (seconds: number | null): FitnessPoints | null =>
  seconds === null || seconds <= 0 ? null : clamp(Math.ceil(seconds / 30));

/** 1-15 push-ups: 1 · 16-25: 2 · 26-35: 3 · 36+: 4 */
const pushupPoints = (reps: number | null): FitnessPoints | null => {
  if (reps === null || reps <= 0) return null;
  if (reps <= 15) return 1;
  if (reps <= 25) return 2;
  if (reps <= 35) return 3;
  return 4;
};

/** Below 0.5 km: 1 · 0.5-0.8: 2 · 0.8-1.1: 3 · 1.2 and above: 4 */
const cardioPoints = (km: number | null): FitnessPoints | null => {
  if (km === null || km <= 0) return null;
  if (km < 0.5) return 1;
  if (km <= 0.8) return 2;
  if (km <= 1.1) return 3;
  return 4;
};

/**
 * Body composition, scored against different thresholds by sex.
 *
 * Read from the body-fat percentage the counselling already records rather
 * than asking for it again — and when sex is not recorded the table cannot be
 * chosen, so the coach's own points answer is the only source.
 */
export const bcaPoints = (bodyFat: number | null, gender: string): FitnessPoints | null => {
  if (bodyFat === null || bodyFat <= 0) return null;
  const g = gender.trim().toLowerCase();
  if (g === "male") {
    if (bodyFat <= 18) return 4;
    if (bodyFat <= 25) return 3;
    if (bodyFat <= 30) return 2;
    return 1;
  }
  if (g === "female") {
    if (bodyFat <= 20) return 4;
    if (bodyFat <= 27) return 3;
    if (bodyFat <= 33) return 2;
    return 1;
  }
  return null;
};

/** The reach test has no measurement — the option chosen IS the score. */
export const REACH_OPTIONS = ["Knee touch", "Ankle touch", "Toe touch", "Heel touch"];
const reachPoints = (choice: string): FitnessPoints | null => {
  const i = REACH_OPTIONS.indexOf(choice.trim());
  return i === -1 ? null : (clamp(i + 1) as FitnessPoints);
};

export interface FitnessAssessment {
  tests: FitnessTest[];
  /** Points scored across the tests that were actually done. */
  total: number;
  /** The most that could have been scored — 4 per completed test. */
  possible: number;
  /** How many of the six were done. */
  completed: number;
  /** True once anything has been recorded. */
  recorded: boolean;
  /** When the coach ran it, if they said. */
  assessedOn: string;
}

/**
 * Scores the assessment from whatever has been recorded.
 *
 * The total is out of the tests actually DONE, not always out of 24: a client
 * who could not attempt the cardio piece should not read as having failed it,
 * and a coach part-way through the session should see a running score.
 */
export function fitnessAssessment(a: Answers): FitnessAssessment {
  const explicit = (id: string): FitnessPoints | null => {
    const n = Number(val(a, id));
    return n >= 1 && n <= 4 ? (n as FitnessPoints) : null;
  };
  const build = (
    key: string,
    label: string,
    derived: FitnessPoints | null,
    pointsId: string,
    measured: string
  ): FitnessTest => {
    const override = explicit(pointsId);
    return {
      key,
      label,
      points: override ?? derived,
      measured,
      overridden: override !== null && derived !== null && override !== derived,
    };
  };

  const plankSecs = num(a, FITNESS_IDS.plankSeconds);
  const pushups = num(a, FITNESS_IDS.pushupsCount);
  const balanceSecs = num(a, FITNESS_IDS.balanceSeconds);
  const km = num(a, FITNESS_IDS.cardioKm);
  const bodyFat = num(a, "q15_bf");
  const reach = val(a, FITNESS_IDS.reachPoints);

  const tests: FitnessTest[] = [
    build("plank", "Core strength (plank)", pointsPerHalfMinute(plankSecs), FITNESS_IDS.plankPoints,
      plankSecs === null ? "" : `${plankSecs}s`),
    build("pushups", "Overall body strength (push-ups)", pushupPoints(pushups), FITNESS_IDS.pushupsPoints,
      pushups === null ? "" : `${pushups} reps`),
    build("balance", "Balance (star pose / one leg)", pointsPerHalfMinute(balanceSecs), FITNESS_IDS.balancePoints,
      balanceSecs === null ? "" : `${balanceSecs}s`),
    build("reach", "Flexibility (reach test)", reachPoints(reach), FITNESS_IDS.reachPoints,
      reach || ""),
    build("bca", "Body composition", bcaPoints(bodyFat, val(a, "gender")), FITNESS_IDS.bcaPoints,
      bodyFat === null ? "" : `${bodyFat}% body fat`),
    build("cardio", "Cardio (10 min distance)", cardioPoints(km), FITNESS_IDS.cardioPoints,
      km === null ? "" : `${km} km`),
  ];

  const done = tests.filter((t) => t.points !== null);
  return {
    tests,
    total: done.reduce((s, t) => s + (t.points ?? 0), 0),
    possible: done.length * 4,
    completed: done.length,
    recorded: done.length > 0,
    assessedOn: val(a, FITNESS_IDS.assessedOn),
  };
}

/** Plain-language band for a completed assessment, or null while partial. */
export function fitnessBand(assessment: FitnessAssessment): string | null {
  if (assessment.completed < 6 || assessment.possible === 0) return null;
  const share = assessment.total / assessment.possible;
  if (share >= 0.85) return "Excellent";
  if (share >= 0.65) return "Good";
  if (share >= 0.45) return "Fair";
  return "Needs work";
}

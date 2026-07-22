// Type-only import, and the two answer helpers are re-declared below rather
// than imported: questions.ts imports the food table from this module to build
// its per-food questions, so a value import in this direction would create a
// runtime import cycle.
import type { Answers } from "./counselling/questions";

const val = (a: Answers, id: string): string => {
  const v = a[id];
  return typeof v === "string" ? v : "";
};
const list = (a: Answers, id: string): string[] => {
  const v = a[id];
  return Array.isArray(v) ? v : [];
};

// ---------------------------------------------------------------------------
// Measured current protein intake, and the week-1 protein target it implies.
//
// Replaces a judgement call (q92 "Current protein assessment: Very low / Low /
// Moderate…") with a number: for every protein food the client actually eats,
// counselling records how often and how much, and each is priced from the same
// foods table that grounds the finished plan. The target is then the client's
// measured intake raised 10-15% — a progression they can actually sustain —
// instead of a figure the model picks for itself (measured drifting 80 -> 62 g
// and 140 -> 125 g across generation runs, always downward once plans got hard
// to hit).
//
// Every gram here is therefore an estimate of what the client ALREADY eats. It
// is only as good as the frequency and portion the dietitian records, which is
// why the counselling form shows the running total during the session.
// ---------------------------------------------------------------------------

/** Diet classes used to decide which foods are offered for a food pattern. */
type FoodClass = "plant" | "dairy" | "egg" | "fish" | "meat";

export interface ProteinFood {
  /** Stable key — forms the counselling question ids, so never renumber. */
  id: string;
  /** Must match the q50 option text exactly; that is how selection is read. */
  label: string;
  /** Standard household portion this food is counted in. */
  portion: string;
  /** Protein in one standard portion, from the foods table. */
  proteinPerPortion: number;
  klass: FoodClass;
}

// Protein per standard portion, read from the seeded foods table — regenerate
// with `npx tsx scripts/protein-reference.mts` after changing staples.json and
// paste the output here. Last verified 21 July 2026.
//
// Portions are the everyday Indian serving a dietitian would picture, and the
// curry forms are used for chicken/fish/mutton deliberately: home eating is
// curry, not a grilled fillet, and pricing 150 g of chicken curry (17.7 g) as
// 150 g of grilled breast (46 g) would inflate every non-vegetarian estimate.
export const PROTEIN_FOODS: ProteinFood[] = [
  { id: "milk", label: "Milk", portion: "1 glass (200 ml)", proteinPerPortion: 6.3, klass: "dairy" },
  { id: "curd", label: "Curd", portion: "1 katori (150 g)", proteinPerPortion: 5.2, klass: "dairy" },
  { id: "greek", label: "Greek or high-protein yogurt", portion: "1 cup (170 g)", proteinPerPortion: 17.3, klass: "dairy" },
  { id: "buttermilk", label: "Buttermilk or chaas", portion: "1 glass (250 ml)", proteinPerPortion: 3.4, klass: "dairy" },
  { id: "paneer", label: "Paneer", portion: "100 g", proteinPerPortion: 18.1, klass: "dairy" },
  { id: "tofu", label: "Tofu", portion: "100 g", proteinPerPortion: 9, klass: "plant" },
  { id: "soy", label: "Soy chunks", portion: "1 katori curry (150 g)", proteinPerPortion: 15.6, klass: "plant" },
  { id: "tempeh", label: "Tempeh", portion: "100 g", proteinPerPortion: 20.3, klass: "plant" },
  { id: "dal", label: "Dal", portion: "1 katori (150 g)", proteinPerPortion: 3.8, klass: "plant" },
  { id: "chole", label: "Chickpeas or chole", portion: "1 katori (150 g)", proteinPerPortion: 9.2, klass: "plant" },
  { id: "rajma", label: "Rajma or beans", portion: "1 katori (150 g)", proteinPerPortion: 8.9, klass: "plant" },
  { id: "sprouts", label: "Sprouts", portion: "1 cup (100 g)", proteinPerPortion: 3, klass: "plant" },
  { id: "chana", label: "Roasted chana", portion: "1 handful (40 g)", proteinPerPortion: 8.2, klass: "plant" },
  { id: "nuts", label: "Nuts or seeds", portion: "1 handful (30 g)", proteinPerPortion: 7.7, klass: "plant" },
  { id: "powder", label: "Protein powder", portion: "1 scoop (30 g)", proteinPerPortion: 23.4, klass: "plant" },
  { id: "eggs", label: "Eggs", portion: "2 eggs", proteinPerPortion: 12.6, klass: "egg" },
  { id: "fish", label: "Fish", portion: "1 katori curry (150 g)", proteinPerPortion: 13.1, klass: "fish" },
  { id: "seafood", label: "Seafood", portion: "1 katori curry (150 g)", proteinPerPortion: 12.8, klass: "fish" },
  { id: "chicken", label: "Chicken", portion: "1 katori curry (150 g)", proteinPerPortion: 17.7, klass: "meat" },
  { id: "meat", label: "Meat", portion: "1 katori curry (150 g)", proteinPerPortion: 10.6, klass: "meat" },
];

// Which food classes each q33 food pattern may be offered. A dietitian can
// still record anything they select in q50; this only decides what the form
// puts in front of them, so a vegetarian consultation is not a wall of
// chicken and fish rows.
const PATTERN_CLASSES: Record<string, FoodClass[]> = {
  Vegetarian: ["plant", "dairy"],
  Jain: ["plant", "dairy"],
  Vegan: ["plant"],
  Eggetarian: ["plant", "dairy", "egg"],
  Pescatarian: ["plant", "dairy", "egg", "fish"],
  "Non-vegetarian": ["plant", "dairy", "egg", "fish", "meat"],
  Flexitarian: ["plant", "dairy", "egg", "fish", "meat"],
};
const ALL_CLASSES: FoodClass[] = ["plant", "dairy", "egg", "fish", "meat"];

/**
 * Foods offered for the recorded food pattern.
 *
 * Returns NOTHING until Q33 is answered: offering the full list first means a
 * dietitian can record chicken for a vegetarian without ever being asked, and
 * an unfiltered list looks identical to a non-vegetarian one, so the filter
 * appears not to work. An unrecognised pattern ("Other") still gets everything
 * — the dietitian has told us they know, we just cannot classify it.
 */
export function foodsForPattern(a: Answers): ProteinFood[] {
  const pattern = val(a, "q33");
  if (!pattern.trim()) return [];
  const allowed = PATTERN_CLASSES[pattern] ?? ALL_CLASSES;
  return PROTEIN_FOODS.filter((f) => allowed.includes(f.klass));
}

// How often, as times per week. Coarse on purpose — a dietitian asking "how
// many days a week?" gets a band, not a decimal, and false precision here
// would not survive contact with a real consultation.
export const FREQUENCY_OPTIONS: { label: string; perWeek: number }[] = [
  { label: "Daily", perWeek: 7 },
  { label: "5–6 days a week", perWeek: 5.5 },
  { label: "3–4 days a week", perWeek: 3.5 },
  { label: "1–2 days a week", perWeek: 1.5 },
  { label: "Less than once a week", perWeek: 0.5 },
  { label: "Never", perWeek: 0 },
];

// Portion relative to the standard one above. Left unanswered it counts as one
// standard portion, so the dietitian only touches this when it differs.
export const PORTION_OPTIONS: { label: string; multiplier: number }[] = [
  { label: "Half portion", multiplier: 0.5 },
  { label: "1 standard portion", multiplier: 1 },
  { label: "1½ portions", multiplier: 1.5 },
  { label: "2 portions", multiplier: 2 },
  { label: "3 or more portions", multiplier: 3 },
];

export const freqQuestionId = (id: string) => `q50p_${id}_freq`;
export const portionQuestionId = (id: string) => `q50p_${id}_portion`;

export interface FoodContribution {
  food: ProteinFood;
  perWeek: number;
  multiplier: number;
  /** Grams of protein this food contributes per DAY. */
  gramsPerDay: number;
}

export interface ProteinIntakeEstimate {
  /** Estimated protein the client eats now, g/day. */
  gramsPerDay: number;
  /** Per kg bodyweight, or null when weight was not recorded. */
  gramsPerKg: number | null;
  /** Highest-contributing foods first; only foods actually eaten. */
  contributions: FoodContribution[];
  /** Foods selected in q50 that have no frequency recorded yet. */
  unrecorded: ProteinFood[];
  /** True once at least one food has a frequency — the estimate is meaningful. */
  measured: boolean;
}

const bodyWeightKg = (a: Answers): number | null => {
  const w = Number(val(a, "q9_weight"));
  return Number.isFinite(w) && w > 0 ? w : null;
};

/**
 * Estimates current daily protein from the recorded frequency and portion of
 * each protein food the client eats. Foods selected in q50 but not yet given a
 * frequency contribute nothing and are reported separately, so a half-filled
 * form reads as incomplete rather than as a genuinely low intake.
 */
export function estimateProteinIntake(a: Answers): ProteinIntakeEstimate {
  const selected = list(a, "q50");
  const contributions: FoodContribution[] = [];
  const unrecorded: ProteinFood[] = [];

  for (const food of PROTEIN_FOODS) {
    if (!selected.includes(food.label)) continue;
    const freqLabel = val(a, freqQuestionId(food.id));
    const freq = FREQUENCY_OPTIONS.find((f) => f.label === freqLabel);
    if (!freq) {
      unrecorded.push(food);
      continue;
    }
    if (freq.perWeek === 0) continue;
    const portionLabel = val(a, portionQuestionId(food.id));
    const multiplier =
      PORTION_OPTIONS.find((p) => p.label === portionLabel)?.multiplier ?? 1;
    contributions.push({
      food,
      perWeek: freq.perWeek,
      multiplier,
      gramsPerDay: (food.proteinPerPortion * multiplier * freq.perWeek) / 7,
    });
  }

  contributions.sort((x, y) => y.gramsPerDay - x.gramsPerDay);
  const gramsPerDay = contributions.reduce((s, c) => s + c.gramsPerDay, 0);
  const weight = bodyWeightKg(a);

  return {
    gramsPerDay: Math.round(gramsPerDay),
    gramsPerKg: weight ? Math.round((gramsPerDay / weight) * 100) / 100 : null,
    contributions,
    unrecorded,
    measured: contributions.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Week-1 target
// ---------------------------------------------------------------------------

// The progression the dietitians asked for: raise what the client already eats
// by this much, so week 1 is a change they can keep.
const INCREASE_LOW = 0.1;
const INCREASE_HIGH = 0.15;

// Where the client should END UP, in g per kg bodyweight — NOT the week-1
// target. A client eating 26 g/day is not asked to eat 118 g next week; the
// weekly +10-15% step walks them there over a couple of months, which is the
// whole point of progressing from measured intake. These are starting
// defaults, not a clinical protocol: confirm them against the dietitian team's
// own standard.
// Resistance training 3+ days a week, losing fat — protein protects muscle
// through the deficit.
const GOAL_TRAINING_FAT_LOSS = 1.6;
// Resistance training 3+ days a week, not in a deficit.
const GOAL_ACTIVE = 1.4;
// Everyone else, including walkers and yoga practitioners: cardio and mobility
// do not create the same protein requirement as lifting.
const GOAL_DEFAULT = 1.2;

export interface ProteinTarget {
  /** The number THIS week's plan must hit, g/day. */
  targetG: number;
  /** Where the client should end up, g/day. */
  goalG: number;
  /** The raw 10-15% band this week's step was drawn from. */
  bandG: [number, number];
  /** Weeks of +10-15% steps still needed to reach goalG; 0 once there. */
  weeksToGoal: number;
  /** Which rule decided the target. */
  basis: "progression" | "goal-reached" | "medical-cap" | "unmeasured";
  /** One line for the dietitian and for the plan record. */
  explanation: string;
}

// Q43 answers that count as resistance training. Only these raise the protein
// goal: the higher g/kg figures exist to support muscle under load, and
// counting exercise days alone put a client whose Q43 was "Walking, Yoga" on
// the 1.6 g/kg goal meant for people who lift. Deliberately strict — add
// "Home workout", "HIIT" or "Starting with LeanR PT" here if the team counts
// them as resistance work.
const RESISTANCE_TRAINING = ["Strength training"];

// Resistance training at a frequency that actually drives a protein
// requirement — the exercise type AND at least three sessions a week.
const doesResistanceTraining = (a: Answers): boolean => {
  const days = Number(val(a, "q44a"));
  if (!Number.isFinite(days) || days < 3) return false;
  return list(a, "q43").some((v) => RESISTANCE_TRAINING.includes(v));
};

const isFatLoss = (a: Answers): boolean =>
  /fat loss|weight loss/i.test(val(a, "q2")) || /fat loss/i.test(val(a, "q44f"));

/**
 * Medical restriction on raising protein — a recorded kidney or liver
 * condition, or an explicit protein limit written into the hard constraints.
 * Never auto-raises past these; the dietitian decides with the doctor.
 */
function medicalProteinCap(a: Answers): string | null {
  const conditions = [...list(a, "q17"), ...list(a, "q18")].join(" ").toLowerCase();
  if (/kidney|renal|nephro|dialysis|liver|hepatic|cirrhosis/.test(conditions)) {
    return "kidney or liver condition recorded";
  }
  const constraints = `${val(a, "q104")} ${val(a, "q19a")}`.toLowerCase();
  if (/protein\s*(max|limit|cap|restrict|≤|<)/.test(constraints)) {
    return "a protein limit is recorded in the clinical constraints";
  }
  return null;
}

function goalGPerKg(a: Answers): number {
  if (!doesResistanceTraining(a)) return GOAL_DEFAULT;
  return isFatLoss(a) ? GOAL_TRAINING_FAT_LOSS : GOAL_ACTIVE;
}

// Compounding +step weeks from `from` to `to`, for the "about N weeks away"
// line. Bounded so a near-zero measured intake cannot report a huge number.
function weeksBetween(from: number, to: number, step: number): number {
  if (from <= 0 || to <= from) return 0;
  return Math.min(52, Math.ceil(Math.log(to / from) / Math.log(1 + step)));
}

/**
 * This week's protein target: the client's measured intake stepped up 10-15%,
 * walking toward a g/kg goal rather than jumping to it. A client eating 26 g
 * gets 30 g next week, not the 118 g their bodyweight ultimately calls for —
 * the counselling asks at length about restriction and dropout patterns, and a
 * 350% overnight change is exactly what those questions exist to prevent.
 *
 * `fromTargetG` continues the ramp for a later week: pass the previous week's
 * target and the step is taken from there instead of from the original
 * measurement. Week-1 generation leaves it undefined; wiring it into the
 * follow-up path is what makes the ramp real week after week.
 */
export function proteinTarget(
  a: Answers,
  estimate: ProteinIntakeEstimate,
  fromTargetG?: number
): ProteinTarget {
  const base = fromTargetG && fromTargetG > 0 ? fromTargetG : estimate.gramsPerDay;
  const band: [number, number] = [
    Math.round(base * (1 + INCREASE_LOW)),
    Math.round(base * (1 + INCREASE_HIGH)),
  ];
  const weight = bodyWeightKg(a);
  const perKg = goalGPerKg(a);
  const goal = weight ? Math.round(weight * perKg) : 0;

  const cap = medicalProteinCap(a);
  if (cap) {
    return {
      targetG: estimate.gramsPerDay,
      goalG: estimate.gramsPerDay,
      bandG: band,
      weeksToGoal: 0,
      basis: "medical-cap",
      explanation: `Protein held at the current ${estimate.gramsPerDay} g/day — ${cap}. Any increase must come from the treating doctor.`,
    };
  }

  if (!estimate.measured) {
    return {
      targetG: 0,
      goalG: goal,
      bandG: band,
      weeksToGoal: 0,
      basis: "unmeasured",
      explanation:
        "No protein-food frequency recorded yet — complete Q50 to measure current intake and set the target.",
    };
  }

  // Midpoint of the requested 10-15% band, and never past the goal.
  const step = (INCREASE_LOW + INCREASE_HIGH) / 2;
  const stepped = Math.round(base * (1 + step));

  if (goal > 0 && stepped >= goal) {
    return {
      targetG: goal,
      goalG: goal,
      bandG: band,
      weeksToGoal: 0,
      basis: "goal-reached",
      explanation: `Current intake ${estimate.gramsPerDay} g/day; a 10-15% step reaches the ${perKg} g/kg goal, so the target is ${goal} g/day.`,
    };
  }

  return {
    targetG: stepped,
    goalG: goal,
    bandG: band,
    weeksToGoal: weeksBetween(stepped, goal, step),
    basis: "progression",
    explanation:
      `Current intake ${estimate.gramsPerDay} g/day (${estimate.gramsPerKg ?? "?"} g/kg). ` +
      `This week: ${stepped} g/day, a ${Math.round(((stepped - base) / Math.max(1, base)) * 100)}% step. ` +
      (goal > 0
        ? `Goal ${goal} g/day (${perKg} g/kg) — about ${weeksBetween(stepped, goal, step)} more weekly steps away.`
        : `Record bodyweight (Q9) to set the long-term goal.`),
  };
}

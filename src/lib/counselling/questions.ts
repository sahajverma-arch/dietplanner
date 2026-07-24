// ---------------------------------------------------------------------------
// LeanR Premium — Final New Client First Counselling question bank.
//
// Source: "LeanR Premium Final New Client First Counselling" (Q1–Q105 across
// 12 sections + final AI independent clinical review). Target duration
// 55–65 minutes. The counselling is conversational: the dietitian asks the
// main question naturally, the client speaks, the dietitian mainly selects
// options (options are not read out). Free text is avoided except where
// options cannot capture the information.
//
// The whole counselling is data: sections → questions, with conditional
// visibility, red-flag rules and audit-score keys. The form renders this
// schema (src/components/ClinicalCounsellingForm.tsx) and the assessment
// engine (./assessment.ts) reads answers back out of it, so adding or
// rewording a question never means touching UI code.
//
// Question tags follow the LeanR classification:
//   core        ask almost every client
//   conditional activated by a previous answer
//   clinical    medical / nutrition safety
//   fitness     training, muscle gain, body composition
//   planning    directly shapes the diet design
// ---------------------------------------------------------------------------

import {
  FREQUENCY_OPTIONS,
  PORTION_OPTIONS,
  PROTEIN_FOODS,
  STAPLE_LABELS,
  foodsForPattern,
  freqQuestionId,
  portionQuestionId,
  stapleQuestionId,
} from "../protein-intake";

export type QuestionType =
  | "text"
  | "textarea"
  | "number"
  | "time"
  | "date"
  | "single"
  | "multi"
  | "scale10"
  // A list of options each carrying a count ("Roti × 2"), stored as string[].
  // Exists so the food day can be tapped instead of typed — see
  // STAPLE_LABELS in src/lib/protein-intake.ts.
  | "portions";

export type Answers = Record<string, string | string[]>;

export type QuestionTag = "core" | "conditional" | "clinical" | "fitness" | "planning";

export interface Question {
  id: string;
  /** Original number in the LeanR Premium bank — shown to the dietitian. */
  n?: number;
  label: string;
  type: QuestionType;
  tag?: QuestionTag;
  options?: string[];
  /**
   * Options that depend on earlier answers (e.g. the protein-food list narrows
   * to what the client's food pattern allows). When present the form renders
   * these instead of `options`; `options` must still list every possibility,
   * since it is what non-UI readers fall back on.
   */
  optionsFor?: (a: Answers) => string[];
  /**
   * Shown in place of the options when `optionsFor` yields none — a question
   * that silently renders zero choices reads as broken, so it must say what is
   * still needed.
   */
  optionsEmptyHint?: string;
  /** Multi-select cap ("Select up to N"). Click order doubles as rank. */
  max?: number;
  placeholder?: string;
  /** Follow-up the dietitian should probe with. */
  probe?: string;
  /** Why we ask / how it changes the plan. */
  why?: string;
  /** Guidance the dietitian must keep in mind (shown as a caution note). */
  note?: string;
  /**
   * Must be answered (when visible) before a diet plan can be generated.
   *
   * A predicate when one question can be satisfied by another: the food-day
   * free text stops being required once the staples for that occasion have
   * been picked, so a dietitian who prefers tapping never has to type.
   * Read it through `isRequired`, never directly.
   */
  required?: boolean | ((a: Answers) => boolean);
  showIf?: (a: Answers) => boolean;
}

/** Resolves `required`, which may be a predicate. */
export const isRequired = (q: Question, a: Answers): boolean =>
  typeof q.required === "function" ? q.required(a) : q.required === true;

export interface Section {
  id: string;
  /** Section number from the LeanR Premium bank. */
  code: string;
  title: string;
  stage: Stage;
  minutes?: string;
  intro?: string;
  questions: Question[];
  showIf?: (a: Answers) => boolean;
}

export type Stage =
  | "Client"
  | "Goals"
  | "Clinical"
  | "Diet"
  | "Fitness"
  | "Lifestyle"
  | "Behaviour"
  | "Assessment";

// --- answer helpers --------------------------------------------------------

export const val = (a: Answers, id: string): string => {
  const v = a[id];
  return typeof v === "string" ? v : "";
};
export const list = (a: Answers, id: string): string[] => {
  const v = a[id];
  return Array.isArray(v) ? v : [];
};
/** True when a single-select equals `option`. */
export const is = (a: Answers, id: string, option: string) => val(a, id) === option;
/** True when a multi-select contains `option`. */
export const has = (a: Answers, id: string, option: string) => list(a, id).includes(option);
/** True when a multi-select contains any of `options`. */
export const hasAny = (a: Answers, id: string, options: string[]) =>
  list(a, id).some((v) => options.includes(v));
export const answered = (a: Answers, id: string) => {
  const v = a[id];
  return Array.isArray(v) ? v.length > 0 : Boolean(v && v.trim());
};
/** Multi-select answered with anything other than the given "none" options. */
export const hasOther = (a: Answers, id: string, none: string[]) =>
  list(a, id).some((v) => !none.includes(v));
/** scale10 value ≤ n (unanswered doesn't count). */
export const scaleAtMost = (a: Answers, id: string, n: number) => {
  const v = Number(val(a, id));
  return Number.isFinite(v) && v >= 1 && v <= n;
};

const RANK_NOTE = "Click in priority order — first click = rank 1.";

// ---------------------------------------------------------------------------
// SECTION 0 — client identity (not part of the question bank; needed to create
// the client record and to link the counselling to the ops appointment).
// ---------------------------------------------------------------------------

const CLIENT: Section = {
  id: "client",
  code: "—",
  title: "Client details",
  stage: "Client",
  minutes: "1–2 min",
  questions: [
    { id: "name", label: "Client full name", type: "text", tag: "core", placeholder: "Anita Verma" },
    { id: "clientCode", label: "Client code (from today's schedule)", type: "text", placeholder: "493030768" },
    { id: "gender", label: "Gender", type: "single", options: ["Female", "Male", "Other", "Prefer not to say"] },
    { id: "phone", label: "Phone", type: "text", placeholder: "+91 98xxx xxxxx" },
    { id: "email", label: "Email", type: "text", placeholder: "client@email.com" },
  ],
};

// ---------------------------------------------------------------------------
// SECTION 1 — CLIENT GOAL AND DEEPER MOTIVATION (Q1–Q8 + goal reflection)
// ---------------------------------------------------------------------------

const GOAL_TYPES_FOR_PHYSIQUE = [
  "Fat loss",
  "Fat loss with muscle preservation",
  "Body recomposition",
  "Muscle gain",
  "Lean mass gain",
  "Improve body shape",
  "Improve muscle definition",
];


// v3.0 wants the confidence of a body-composition number recorded next to the
// number itself, because the AI rule forbids a low-confidence body-fat value
// from driving calorie targets on its own.
const NO_CONDITION_V3 = "No Medical Condition";

// ---------------------------------------------------------------------------
// STAGE 1 — INTRODUCTION, RAPPORT & GOAL DISCOVERY (Q1–Q6)
// ---------------------------------------------------------------------------

const S1: Section = {
  id: "goal",
  code: "1",
  title: "Introduction, rapport & goal discovery",
  stage: "Goals",
  minutes: "8–10 min",
  intro:
    "Introduce yourself and the purpose first. Q1 is a conversation, not a form — let the client describe their day and fill the fields from what they say.",
  questions: [
    // Q1 is one spoken question that fills ten fields. Age, gender, work type,
    // shift, country and city already have storage keys, so only the four
    // genuinely new fields are added — re-asking under fresh ids would orphan
    // the answers already filed for the live clients.
    { id: "q9_age", n: 1, tag: "core", type: "number", label: "Age (years)", required: true },
    {
      id: "q1_occupation", n: 1, tag: "core", type: "text", label: "Occupation",
      placeholder: "e.g. Software engineer, school teacher, business owner",
    },
    {
      id: "q54", n: 1, tag: "core", type: "single", label: "Work type",
      options: [
        "Desk-based", "Standing", "Physical work", "Field work", "Work from home", "Hybrid",
        "Student", "Homemaker", "Not working", "Other",
      ],
      required: true,
    },
    {
      id: "q1_hours", n: 1, tag: "core", type: "text", label: "Working hours",
      placeholder: "e.g. 9:30 AM to 7 PM, 6 days",
    },
    {
      id: "q54a", n: 1, tag: "core", type: "single", label: "Shift pattern",
      options: ["Day", "Evening", "Night", "Rotational", "Split", "Flexible", "Not applicable"],
    },
    { id: "q34a", n: 1, tag: "core", type: "text", label: "Country", placeholder: "e.g. India" },
    { id: "q34d", n: 1, tag: "core", type: "text", label: "State", placeholder: "e.g. Punjab" },
    { id: "q34b", n: 1, tag: "core", type: "text", label: "City", placeholder: "e.g. Chandigarh" },
    {
      id: "q1_routine", n: 1, tag: "core", type: "textarea", label: "General daily routine",
      placeholder: "Wake, work, meals, travel, training, sleep — in the client's own words.",
      why: "Every later feasibility decision (meal timing, prep, carrying food) is judged against this routine.",
    },
    {
      id: "q1", n: 2, tag: "core", type: "multi", max: 3, required: true,
      label: "What motivated you to begin your health journey with LeanR at this point in your life?",
      options: [
        "Recent weight gain", "Increased body fat", "Clothes fitting tighter", "Poor body shape",
        "Low confidence", "Low energy", "Reduced strength", "Poor stamina",
        "Poor workout performance", "Slow recovery", "Health reports", "Doctor recommendation",
        "Existing medical condition", "Wedding", "Special occasion", "Pregnancy planning",
        "Post-pregnancy transformation", "Sports goal", "Weight regain",
        "Previous failed attempts", "Plateau", "Family motivation", "Better lifestyle",
        "Want professional guidance", "Other",
      ],
      probe: "Why now specifically, and why this month rather than last year?",
    },
    {
      id: "q2", n: 3, tag: "core", type: "single", required: true,
      label: "What would you most like to achieve through LeanR?",
      options: [
        "Fat Loss", "Weight Loss", "Body Recomposition", "Fat Loss With Muscle Preservation",
        "Muscle Gain", "Healthy Weight Gain", "Improved Fitness",
        "Sports/Performance Improvement", "Clinical Nutrition Improvement",
        "Lifestyle Improvement", "Maintenance", "Not Sure – Need Dietitian Guidance",
      ],
      why: "The single primary result — the whole energy and protein strategy hangs off it.",
    },
    {
      // v3.0 asks this of every client, so the old conditional on the goal type
      // is gone and the question is a single select rather than a multi.
      id: "q6", n: 4, tag: "core", type: "single",
      label: "What kind of physical transformation are you hoping to achieve?",
      options: [
        "Lean Physique", "Athletic Physique", "Toned Physique", "Muscular Physique",
        "Better Body Shape", "Smaller Waist", "Better Muscle Definition", "Body Recomposition",
        "Healthy Weight Gain", "No Specific Appearance Goal", "Need Dietitian Guidance",
      ],
    },
    {
      id: "q4", n: 5, tag: "core", type: "multi", max: 3, required: true,
      label: "Why is achieving this goal personally important to you?",
      options: [
        "Better confidence", "Better appearance", "Better health", "Better fitness",
        "Better mobility", "Better quality of life", "Better sports performance",
        "Better energy", "Future disease prevention", "Family responsibility", "Wedding/Event",
        "Pregnancy planning", "Doctor advised", "Better relationship with food",
        "Sustainable lifestyle", "Other",
      ],
      why: "The deeper reason is what coaching messages are written from when motivation drops.",
    },
    {
      id: "q7", n: 6, tag: "core", type: "single",
      label: "Do you have a target date or specific timeline for achieving your goal?",
      options: [
        "No Deadline", "Flexible Goal", "Wedding", "Competition", "Sports Event", "Birthday",
        "Holiday", "Medical Follow-up", "Pregnancy Timeline", "Other",
      ],
    },
    {
      id: "q7a", n: 6, tag: "conditional", type: "date", label: "Target date",
      showIf: (a) => answered(a, "q7") && !is(a, "q7", "No Deadline"),
    },
    {
      id: "q7b", n: 6, tag: "conditional", type: "single", label: "Priority",
      options: ["Flexible", "Important", "Fixed"],
      showIf: (a) => answered(a, "q7") && !is(a, "q7", "No Deadline"),
    },
  ],
};

// ---------------------------------------------------------------------------
// STAGE 2 — BODY PROFILE & TRANSFORMATION HISTORY (Q7–Q11)
// ---------------------------------------------------------------------------

const S2: Section = {
  id: "history",
  code: "2",
  title: "Body profile & transformation history",
  stage: "Goals",
  minutes: "8–10 min",
  questions: [
    { id: "q9_height", n: 7, tag: "core", type: "number", label: "Height (cm)", required: true },
    { id: "q9_weight", n: 7, tag: "core", type: "number", label: "Current weight (kg)", required: true },
    {
      id: "q9_weight_high", n: 7, tag: "core", type: "number", label: "Highest adult weight (kg)",
      note: "Leave blank if unknown.",
    },
    {
      id: "q9_weight_low", n: 7, tag: "core", type: "number", label: "Lowest adult weight (kg)",
      note: "Leave blank if unknown.",
    },
    {
      id: "q9_weight_comfort", n: 7, tag: "core", type: "number",
      label: "Comfortable / preferred weight (kg)",
      note: "Leave blank if the client has never identified one.",
      why: "A weight the client has actually held before is a more defensible target than a round number.",
    },
    {
      id: "q9_weight_1y", n: 7, tag: "core", type: "number", label: "Weight one year ago (kg)",
      note: "Leave blank if unknown.",
    },
    {
      id: "q10", n: 8, tag: "core", type: "multi", required: true,
      label: "How has your weight and body shape changed during the last one year?",
      options: [
        "Gradual Weight Gain", "Rapid Weight Gain", "Gradual Weight Loss", "Rapid Weight Loss",
        "Stable Weight", "Frequent Fluctuations", "Fat Gain", "Muscle Loss",
        "Stable Weight but Body Shape Changed", "Not Sure",
      ],
    },
    {
      id: "q10a", n: 8, tag: "conditional", type: "number", label: "Approximate weight change (kg)",
      showIf: (a) => hasOther(a, "q10", ["Stable Weight", "Not Sure"]),
    },
    {
      id: "q10b", n: 8, tag: "conditional", type: "single", label: "Time period",
      // Kept as bands rather than v3.0's free text: the trajectory arithmetic
      // downstream needs a period it can compare, and a typed phrase is not.
      options: [
        "Less than 1 month", "1–3 months", "3–6 months", "6–12 months", "1–2 years",
        "More than 2 years", "Not sure",
      ],
      showIf: (a) => hasOther(a, "q10", ["Stable Weight", "Not Sure"]),
    },
    {
      id: "q10c", n: 8, tag: "conditional", type: "text", label: "Major body-shape changes",
      placeholder: "e.g. waist up two sizes, arms visibly thinner",
      showIf: (a) => hasOther(a, "q10", ["Not Sure"]),
    },
    {
      id: "q11", n: 9, tag: "core", type: "multi", max: 5,
      label: "What do you feel contributed the most to these changes?",
      options: [
        "Job/Lifestyle Change", "Sedentary Lifestyle", "Exercise Stopped", "Exercise Increased",
        "Injury", "Illness", "Surgery", "Medication", "Pregnancy/Postpartum",
        "Hormonal Changes", "Menopause/Perimenopause", "Stress", "Poor Sleep",
        "Emotional Eating", "Outside Food", "Alcohol", "Travel", "Meal Skipping",
        "Restrictive Dieting", "Low Appetite", "Increased Appetite", "No Clear Reason", "Other",
      ],
    },
    {
      id: "q12", n: 10, tag: "core", type: "multi", required: true,
      label:
        "What weight-loss, weight-gain, fitness or nutrition approaches have you tried previously, and what happened?",
      options: [
        "Calorie Counting", "Dietitian Plan", "Gym", "Personal Trainer", "Intermittent Fasting",
        "Keto", "Low Carb", "Meal Skipping", "Portion Control", "Home Workouts", "Running",
        "Weight-Management Medicines", "Supplements", "Commercial Program", "Self-Planned Diet",
        "Never Tried", "Other",
      ],
    },
    {
      id: "q12c", n: 10, tag: "conditional", type: "textarea",
      label: "For each significant attempt — approach, duration, approximate weight/body change",
      placeholder: "e.g. keto — 3 months, −7 kg; gym + self-planned diet — 6 weeks, no change",
      showIf: (a) => hasOther(a, "q12", ["Never Tried"]),
    },
    {
      id: "q12a", n: 10, tag: "conditional", type: "single", label: "Result",
      options: [
        "Successful and Maintained", "Successful but Regained", "Plateau", "Minimal Result",
        "No Result", "Gained Weight", "Could Not Continue",
      ],
      showIf: (a) => hasOther(a, "q12", ["Never Tried"]),
    },
    {
      id: "q12b", n: 10, tag: "conditional", type: "multi", max: 3,
      label: "Main reason for stopping",
      options: [
        "Hunger", "Cravings", "Restrictive Diet", "Family Food", "Work", "Travel",
        "Poor Results", "Low Motivation", "Cost", "Digestive Problems", "Cooking Difficulty",
        "Other",
      ],
      showIf: (a) => hasOther(a, "q12", ["Never Tried"]),
      why: "The reason it stopped last time is the failure mode this plan has to design around.",
    },
    {
      id: "q16", n: 11, tag: "core", type: "multi",
      label:
        "Looking back, when were you healthiest or most consistent, and what helped you succeed?",
      options: [
        "Fixed Work Schedule", "Better Sleep", "Lower Stress", "Home-Cooked Food",
        "Regular Meals", "Family Support", "Workout Partner", "Gym Routine", "Walking",
        "Dietitian Support", "Personal Trainer", "Meal Preparation", "Less Travel",
        "Less Outside Food", "Better Motivation", "Weight Tracking", "Food Tracking",
        "Simpler Routine", "Never Had Such a Phase",
      ],
      why: "The client's own success pattern — rebuilding it is cheaper than inventing a new routine.",
    },
    {
      id: "q16a", n: 11, tag: "planning", type: "text",
      label: "Rank the top 3 success factors (in order)",
      placeholder: "e.g. 1) Meal preparation 2) Gym routine 3) Better sleep",
      note: RANK_NOTE,
      showIf: (a) => hasOther(a, "q16", ["Never Had Such a Phase"]),
    },
    // CARRIED OVER from the pre-v3.0 bank. v3.0 Section 1 has no equivalent,
    // and each of these is the sole trigger for a clinical red flag that would
    // otherwise stop firing entirely (see scripts/tests/clinical-rules.test.mts).
    {
      id: "q13", n: 13, tag: "clinical", type: "single",
      label: "Have you ever lost weight very quickly or followed a highly restrictive diet?",
      options: ["Yes", "No", "Not sure"],
      why: "Restriction–regain history changes the energy strategy (stabilise before deficit).",
    },
    {
      id: "q13a", tag: "conditional", type: "number", label: "Approximate weight lost (kg)",
      showIf: (a) => is(a, "q13", "Yes"),
    },
    {
      id: "q13b", tag: "conditional", type: "single", label: "Over what period?",
      options: ["Less than 2 weeks", "2–4 weeks", "1–2 months", "2–3 months", "More than 3 months"],
      showIf: (a) => is(a, "q13", "Yes"),
    },
    {
      id: "q13c", tag: "conditional", type: "multi",
      label: "What happened during or after?",
      options: [
        "Severe hunger", "Weakness", "Dizziness", "Hair fall", "Constipation",
        "Menstrual changes", "Poor workout performance", "Strength loss", "Excessive fatigue",
        "Strong cravings", "Loss-of-control eating", "Frequent illness", "Weight regain",
        "Rapid weight regain", "No major problem", "Other",
      ],
      showIf: (a) => is(a, "q13", "Yes"),
    },
  ],
};

// ---------------------------------------------------------------------------
// STAGE 3 — BODY COMPOSITION & OBJECTIVE BASELINE (Q12–Q13)
//
// v3.0's Q13 re-lists weight, waist, hip, body fat, sleep, stress and fluids,
// all of which Q7, Q12, Q53, Q54 and Q55 already capture. Asking them twice
// would mean two storage keys for one fact and a second chance to disagree with
// the first, so the baseline block here only carries the fields nothing else
// owns; the rest is read back from the questions that own them.
// ---------------------------------------------------------------------------

const S3: Section = {
  id: "baseline",
  code: "3",
  title: "Body composition & objective baseline",
  stage: "Clinical",
  minutes: "5–6 min",
  intro:
    "Baseline weight, waist, hip, body fat, sleep, stress and fluids come from Q7, Q12 and Stage 11 — they are not re-asked here. Everything future progress is judged against is fixed on this date.",
  questions: [
    {
      id: "q15", n: 12, tag: "fitness", type: "multi",
      label:
        "Do you have recent body-composition measurements, circumference measurements or progress photos?",
      // Ordered highest to lowest confidence on purpose: the list doubles as the
      // v3.0 data-quality hierarchy the dietitian reads off while asking.
      options: [
        "DEXA", "Clinical/Validated BIA", "Professional/Gym BIA", "Consumer Smart Scale",
        "Measuring Tape", "Progress Photos", "Visual Estimate", "None",
      ],
      note: "Tier 1 DEXA · Tier 2 validated clinical BIA · Tier 3 professional BIA · Tier 4 smart scale · Tier 5 circumferences · Tier 6 visual estimate.",
    },
    {
      id: "q15_date", n: 12, tag: "conditional", type: "date", label: "Date of measurement",
      showIf: (a) => hasOther(a, "q15", ["None"]),
    },
    {
      id: "q15_bf", n: 12, tag: "conditional", type: "number", label: "Body fat (%)",
      showIf: (a) => hasOther(a, "q15", ["None"]),
    },
    {
      id: "q15_muscle", n: 12, tag: "conditional", type: "number", label: "Muscle mass (kg)",
      showIf: (a) => hasOther(a, "q15", ["None"]),
    },
    {
      id: "q15_smm", n: 12, tag: "conditional", type: "number", label: "Skeletal muscle (kg)",
      showIf: (a) => hasOther(a, "q15", ["None"]),
    },
    {
      id: "q15_visceral", n: 12, tag: "conditional", type: "number", label: "Visceral fat",
      showIf: (a) => hasOther(a, "q15", ["None"]),
    },
    {
      id: "q15_waist", n: 12, tag: "conditional", type: "number",
      label: "Waist (cm — note the unit if inches)",
      showIf: (a) => hasOther(a, "q15", ["None"]),
    },
    {
      id: "q15_hip", n: 12, tag: "conditional", type: "number", label: "Hip",
      showIf: (a) => hasOther(a, "q15", ["None"]),
    },
    {
      id: "q15_chest", n: 12, tag: "conditional", type: "number", label: "Chest",
      showIf: (a) => hasOther(a, "q15", ["None"]),
    },
    {
      id: "q15_arm", n: 12, tag: "conditional", type: "number", label: "Arms",
      showIf: (a) => hasOther(a, "q15", ["None"]),
    },
    {
      id: "q15_thigh", n: 12, tag: "conditional", type: "number", label: "Thigh",
      showIf: (a) => hasOther(a, "q15", ["None"]),
    },
    {
      id: "q15_assess", n: 12, tag: "planning", type: "single",
      label: "Body-composition confidence",
      options: ["High Confidence", "Moderate Confidence", "Low Confidence", "Insufficient Data"],
      note: "Anything below High is a trend signal, not a number. A low-confidence body-fat or muscle figure must not set calorie targets or drive a clinical decision on its own.",
    },
    {
      id: "q15_src", n: 13, tag: "planning", type: "single", label: "Body-fat measurement source",
      options: [
        "DEXA", "Clinical/Validated BIA", "Professional/Gym BIA", "Consumer Smart Scale",
        "Measuring Tape", "Visual Estimate", "Unknown",
      ],
      showIf: (a) => answered(a, "q15_bf"),
    },
    {
      id: "q13_bf_conf", n: 13, tag: "planning", type: "single", label: "Body-fat confidence",
      options: ["High", "Moderate", "Low"],
      showIf: (a) => answered(a, "q15_bf"),
    },
    {
      id: "q13_meal_consistency", n: 13, tag: "planning", type: "scale10",
      label: "Current meal consistency (1–10)",
    },
    {
      id: "q13_protein_adequacy", n: 13, tag: "planning", type: "single",
      label: "Current protein adequacy",
      options: ["Low", "Moderate", "Good", "Unknown"],
      note: "A first impression only. The measured intake from the protein section is what the target is built from.",
    },
    { id: "q13_diet_quality", n: 13, tag: "planning", type: "scale10", label: "Current diet quality (1–10)" },
    {
      id: "q13_adherence", n: 13, tag: "planning", type: "scale10",
      label: "Self-rated current nutrition adherence (1–10)",
    },
    {
      id: "q13_date", n: 13, tag: "core", type: "date", label: "Baseline date", required: true,
      why: "Every future review compares against this date, so a plan generated without it has nothing to trend from.",
    },
    {
      id: "q13_completeness", n: 13, tag: "planning", type: "single", label: "Baseline completeness",
      options: ["Complete", "Sufficient", "Partially Complete", "Insufficient"],
    },
  ],
};

// ---------------------------------------------------------------------------
// STAGE 4 — MEDICAL, CLINICAL & SAFETY ASSESSMENT (Q14–Q21)
// ---------------------------------------------------------------------------

const S4: Section = {
  id: "medical",
  code: "4",
  title: "Medical, clinical & safety assessment",
  stage: "Clinical",
  minutes: "10–12 min",
  intro:
    "Blood-report flow: report upload → AI extraction → Dietitian verification. Nothing in this stage is optional for safety, but nothing may be pushed either — record what the client volunteers.",
  questions: [
    {
      id: "q17", n: 14, tag: "clinical", type: "multi", required: true,
      label: "Have you ever been diagnosed with any medical condition?",
      // Grouped in the spec as Metabolic / Thyroid & Hormonal / Heart & Blood
      // Pressure / Liver / Kidney / Digestive / Blood & Nutritional / Bone &
      // Joint / Respiratory / Other; the schema has no group concept, so the
      // spec order is preserved instead and the grouping stays readable.
      options: [
        // Metabolic
        "Diabetes Type 1", "Diabetes Type 2", "Prediabetes", "Insulin Resistance", "Obesity",
        "Metabolic Syndrome",
        // Thyroid & hormonal
        "Hypothyroidism", "Hyperthyroidism", "Hashimoto's Thyroiditis", "Graves' Disease",
        "PCOS/PCOD", "Endometriosis", "Hormonal Imbalance", "Menopause", "Perimenopause",
        // Heart & blood pressure
        "Hypertension", "Low Blood Pressure", "High Cholesterol", "High Triglycerides",
        "Heart Disease", "Heart Failure", "Previous Heart Attack", "Arrhythmia",
        // Liver
        "Fatty Liver Grade I", "Fatty Liver Grade II", "Fatty Liver Grade III", "Hepatitis",
        "Other Liver Disease",
        // Kidney
        "Kidney Stones", "Chronic Kidney Disease", "High Uric Acid", "Gout",
        // Digestive
        "GERD", "Gastritis", "IBS", "IBD", "Crohn's Disease", "Ulcerative Colitis",
        "Celiac Disease", "Gallstones",
        // Blood & nutritional
        "Anaemia", "Iron Deficiency", "Vitamin D Deficiency", "Vitamin B12 Deficiency",
        "Folate Deficiency",
        // Bone & joint
        "Arthritis", "Osteoporosis", "Osteopenia",
        // Respiratory
        "Asthma", "Sleep Apnea",
        // Other
        "Autoimmune Disease", "Previous Cancer", "Current Cancer Treatment", "Other",
        NO_CONDITION_V3,
      ],
    },
    {
      id: "q17d", n: 14, tag: "clinical", type: "single", label: "When diagnosed",
      options: ["<6 months", "6–12 months", "1–3 years", ">3 years"],
      showIf: (a) => hasOther(a, "q17", [NO_CONDITION_V3]),
    },
    {
      id: "q17a", n: 14, tag: "clinical", type: "single", label: "Current status",
      options: ["Controlled", "Improving", "Stable", "Uncontrolled", "Under Investigation"],
      showIf: (a) => hasOther(a, "q17", [NO_CONDITION_V3]),
    },
    {
      id: "q17b", n: 14, tag: "clinical", type: "single", label: "Doctor follow-up",
      options: ["Regular", "Occasionally", "Not Required", "Never"],
      showIf: (a) => hasOther(a, "q17", [NO_CONDITION_V3]),
    },
    {
      id: "q17c", n: 14, tag: "clinical", type: "textarea",
      label: "Per-condition notes (which condition, since when, status, treating doctor)",
      placeholder: "e.g. Hypothyroidism since 2022 — controlled on 50 mcg; PCOS/PCOD — under investigation",
      showIf: (a) => hasOther(a, "q17", [NO_CONDITION_V3]),
      note: "The single status and follow-up answers above cover the client overall; use this when two conditions differ.",
    },
    {
      id: "q107", n: 15, tag: "clinical", type: "multi",
      label: "Is there any relevant family history of medical conditions?",
      options: [
        "Diabetes", "Thyroid Disease", "Obesity", "Hypertension", "High Cholesterol",
        "Heart Disease", "Stroke", "Kidney Disease", "Fatty Liver", "PCOS", "Cancer",
        "Autoimmune Disease", "None", "Don't Know",
      ],
      why: "First-degree family history raises the screening threshold even when the client's own reports are still normal.",
    },
    {
      id: "q107a", n: 15, tag: "conditional", type: "text", label: "Relationship",
      placeholder: "e.g. Father — diabetes; Mother — hypothyroidism",
      showIf: (a) => hasOther(a, "q107", ["None", "Don't Know"]),
    },
    {
      id: "q18", n: 16, tag: "clinical", type: "multi",
      label:
        "Have you undergone any significant surgery, hospitalization, serious injury or major medical event?",
      options: [
        "General Surgery", "Bariatric Surgery", "Orthopaedic Surgery", "Cardiac Surgery",
        "Women's Health Surgery", "Cancer Surgery", "Organ Surgery", "Major Hospitalization",
        "Accident", "Fracture", "Severe Infection", "Other", "None",
      ],
    },
    {
      id: "q18b", n: 16, tag: "conditional", type: "textarea", label: "Event and date/year",
      placeholder: "e.g. Gallbladder removal — 2019; ACL reconstruction — 2023",
      showIf: (a) => hasOther(a, "q18", ["None"]),
    },
    {
      id: "q18a", n: 16, tag: "conditional", type: "multi", label: "Current impact",
      options: [
        "No Impact", "Affects Eating", "Affects Digestion", "Affects Exercise",
        "Affects Mobility", "Chronic Pain", "Requires Medical Monitoring",
      ],
      showIf: (a) => hasOther(a, "q18", ["None"]),
    },
    {
      id: "q19", n: 17, tag: "clinical", type: "single", required: true,
      label: "Are you currently taking any medicines regularly?",
      options: ["Yes", "No"],
    },
    {
      id: "q19a", n: 17, tag: "clinical", type: "textarea", required: true,
      label: "For each medicine — name, reason, dose, timing, before/with/after food",
      placeholder: "e.g. Thyronorm 50 mcg — hypothyroidism, morning, empty stomach; Metformin 500 mg — after dinner",
      showIf: (a) => is(a, "q19", "Yes"),
      note: "Food-medicine timing is a hard constraint on meal timing, not a preference.",
    },
    {
      id: "q19b", n: 17, tag: "clinical", type: "single", label: "Recent changes",
      options: ["No", "Started recently", "Dose increased", "Dose reduced", "Medicine changed", "Not sure"],
      showIf: (a) => is(a, "q19", "Yes"),
      why: "A dose change in the last few weeks can explain weight, appetite or energy movement that would otherwise be blamed on diet.",
    },
    {
      id: "q20", n: 18, tag: "clinical", type: "multi", required: true,
      label: "Have you had relevant blood tests during the last 12 months?",
      options: [
        "CBC", "HbA1c", "Fasting Blood Sugar", "PP Blood Sugar", "Fasting Insulin",
        "Lipid Profile", "Liver Function", "Kidney Function", "Thyroid Profile", "Vitamin D",
        "Vitamin B12", "Iron Profile", "Ferritin", "Uric Acid", "Hormonal Profile", "Other",
      ],
    },
    {
      id: "q20c", n: 18, tag: "clinical", type: "single", label: "Report status",
      options: ["Reports Available", "Reports Not Available"],
      showIf: (a) => answered(a, "q20"),
    },
    {
      id: "q20b", n: 18, tag: "clinical", type: "textarea",
      label: "For relevant tests — test, date, result",
      placeholder: "e.g. HbA1c 6.1 (12 Mar); Vitamin D 14 ng/mL (12 Mar); TSH 8.2 (2 Jan)",
      showIf: (a) => is(a, "q20c", "Reports Available"),
    },
    {
      id: "q20a", n: 18, tag: "clinical", type: "single", label: "Status",
      options: ["Normal", "Abnormal", "Unsure"],
      showIf: (a) => is(a, "q20c", "Reports Available"),
    },
    {
      id: "q20d", n: 18, tag: "clinical", type: "multi", label: "Action",
      options: ["Upload Report", "AI Extract Report", "Dietitian Verification"],
      showIf: (a) => is(a, "q20c", "Reports Available"),
      note: "An AI-extracted value is not verified data until a dietitian has confirmed it.",
    },
    {
      id: "q21", n: 19, tag: "clinical", type: "multi", required: true,
      label: "Are you currently experiencing any symptoms that concern you?",
      options: [
        "Chest Pain", "Breathlessness", "Palpitations", "Severe Fatigue", "Frequent Dizziness",
        "Swelling in Legs", "Black Stool", "Blood in Stool", "Repeated Vomiting",
        "Rapid Unexplained Weight Loss", "Severe Headache During Exercise", "Fainting", "None",
        "Other",
      ],
      note: "Anything other than None is a stop-and-check, not a note for later.",
    },
    {
      id: "q21c", n: 19, tag: "clinical", type: "single", label: "Dietitian safety decision",
      options: [
        "Continue Normally", "Clinical Dietitian Review", "Doctor Clearance Recommended",
        "SOP Escalation Required",
      ],
      showIf: (a) => hasOther(a, "q21", ["None"]),
    },
    {
      id: "q22", n: 20, tag: "clinical", type: "multi", required: true,
      label: "Has any doctor advised specific dietary or exercise restrictions?",
      options: [
        "Low Salt", "Fluid Restriction", "Protein Restriction", "Potassium Restriction",
        "Purine Restriction", "Gluten Free", "Lactose Free", "Low Fat", "Low Sugar",
        "Food-Medicine Timing", "Exercise Restriction", "Avoid Heavy Lifting", "Other",
        "No Restrictions",
      ],
      note: "A doctor's instruction overrides every other planning decision, including the client's own preferences.",
    },
    {
      id: "q22a", n: 20, tag: "clinical", type: "textarea", label: "Instruction details",
      placeholder: "e.g. fluid restricted to 1.5 L/day; protein max 0.8 g/kg per nephrologist; no high-intensity cardio",
      showIf: (a) => hasOther(a, "q22", ["No Restrictions"]),
    },
    {
      // No longer gated on gender: v3.0 puts low testosterone and fertility
      // treatment in the same list, so the question is asked wherever it is
      // clinically relevant rather than only of female clients.
      id: "q66", n: 21, tag: "clinical", type: "multi",
      label:
        "Are there hormonal or reproductive-health factors that may affect your nutrition journey?",
      options: [
        "Regular Cycle", "Irregular Periods", "Missed Periods", "Heavy Bleeding", "Severe Pain",
        "PCOS", "Endometriosis", "Trying to Conceive", "Pregnant", "Breastfeeding", "Postpartum",
        "Perimenopause", "Menopause", "Low Testosterone Diagnosed", "Fertility Treatment",
        "None", "Prefer Not to Answer", "Not Applicable",
      ],
      note: "Never push for an answer here. Pregnancy and breastfeeding stop any deficit-led plan outright.",
    },
    // CARRIED OVER from the pre-v3.0 bank. v3.0 Section 1 has no equivalent,
    // and each of these is the sole trigger for a clinical red flag that would
    // otherwise stop firing entirely (see scripts/tests/clinical-rules.test.mts).
    {
      id: "cr1", tag: "clinical", type: "multi",
      label: "Clinical reflection — your selection",
      options: [
        "No major clinical limitation identified", "Diet requires clinical modification",
        "Blood-report review required", "Medical instruction affects planning",
        "Digestive strategy required", "Allergy restriction required",
        "Doctor clearance should be considered", "Senior Dietitian review required",
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// STAGE 5 — DIGESTION, ALLERGIES & FOOD TOLERANCE (Q22–Q23)
//
// v3.0's Q23 is one question covering allergy, intolerance and digestive
// trigger. It stays split across q27 (allergen — never appears in any meal) and
// q26 (trigger food — reduced or timed differently), because the plan treats the
// two completely differently and a single merged list would flatten that.
// ---------------------------------------------------------------------------

const S5: Section = {
  id: "digestion",
  code: "5",
  title: "Digestion, allergies & food tolerance",
  stage: "Clinical",
  minutes: "5–6 min",
  questions: [
    {
      id: "q23", n: 22, tag: "core", type: "single", required: true,
      label: "How would you describe your digestion overall?",
      options: [
        "Excellent", "Mostly Comfortable", "Occasionally Uncomfortable",
        "Frequently Uncomfortable", "Daily Digestive Problems", "Severe Digestive Issues",
        "Not Sure",
      ],
    },
    {
      id: "q24", n: 22, tag: "clinical", type: "multi", label: "Digestive symptoms",
      options: [
        "Bloating", "Gas", "Acidity", "Heartburn", "Acid Reflux", "Constipation",
        "Loose Motions", "Alternating Bowel Pattern", "Stomach Pain", "Cramps", "Nausea",
        "Vomiting", "Early Fullness", "Excessive Burping", "None", "Other",
      ],
    },
    {
      id: "q24a", n: 22, tag: "conditional", type: "single", label: "Frequency of the main symptom",
      options: ["Rare", "1–2 times per week", "3–5 times per week", "Daily", "Multiple times daily"],
      showIf: (a) => hasOther(a, "q24", ["None"]),
    },
    {
      id: "q24b", n: 22, tag: "conditional", type: "multi", label: "Timing",
      options: [
        "Morning", "After breakfast", "After lunch", "Evening", "After dinner", "Night",
        "After specific foods", "During stress", "Around training", "Random",
      ],
      showIf: (a) => hasOther(a, "q24", ["None"]),
    },
    {
      id: "q24c", n: 22, tag: "conditional", type: "scale10", label: "Severity (1–10)",
      showIf: (a) => hasOther(a, "q24", ["None"]),
    },
    {
      id: "q24d", n: 22, tag: "conditional", type: "text", label: "Food association",
      placeholder: "e.g. worse after dal and rajma; fine on plain khichdi days",
      showIf: (a) => hasOther(a, "q24", ["None"]),
      why: "A symptom tied to a food is a plan constraint; a symptom tied to nothing is a monitoring item.",
    },
    {
      id: "q25", n: 22, tag: "core", type: "single", required: true, label: "Bowel frequency",
      options: [
        "More than 3 times daily", "2–3 times daily", "Once daily", "Once every 2 days",
        "Less than 3 times weekly", "Highly irregular", "Prefer not to answer",
      ],
    },
    {
      // Was a multi-select of stool experience. v3.0 asks for one consistency, so
      // pain and incomplete emptying become their own yes/no fields rather than
      // options buried in a list.
      id: "q25a", n: 22, tag: "clinical", type: "single", label: "Consistency",
      options: ["Normal", "Hard", "Loose", "Mixed"],
    },
    {
      id: "q25b", n: 22, tag: "clinical", type: "single", label: "Pain",
      options: ["Yes", "No"],
    },
    {
      id: "q25c", n: 22, tag: "clinical", type: "single", label: "Incomplete emptying",
      options: ["Yes", "No"],
    },
    {
      id: "q108", n: 23, tag: "clinical", type: "multi",
      label: "How would you classify each food that you cannot eat or that causes symptoms?",
      options: [
        "Medically Diagnosed Allergy", "Suspected Allergy", "Food Intolerance",
        "Digestive Trigger", "Other Reaction",
      ],
      why: "A diagnosed allergy is a zero-tolerance exclusion; an intolerance is a dose and timing decision. Recording which is which stops the plan over-restricting.",
    },
    {
      id: "q27", n: 23, tag: "clinical", type: "multi", required: true,
      label: "Do you have any known food allergy?",
      // v3.0 leaves the allergen list free text. The named major allergens are
      // kept because an allergen typed as free text is one spelling away from
      // not matching anything the plan checks against.
      options: [
        "No known allergy", "Milk", "Egg", "Peanut", "Tree nuts", "Wheat", "Soy", "Fish",
        "Shellfish", "Sesame", "Other",
      ],
      note: "An allergen must never appear in any meal, in any form or preparation.",
    },
    {
      id: "q27a", n: 23, tag: "clinical", type: "single", label: "Reaction severity",
      options: ["Mild", "Moderate", "Severe", "Previous emergency reaction", "Unknown"],
      showIf: (a) => hasOther(a, "q27", ["No known allergy"]),
    },
    {
      id: "q27b", n: 23, tag: "clinical", type: "single", label: "Professionally diagnosed?",
      options: ["Yes", "No", "Not sure"],
      showIf: (a) => hasOther(a, "q27", ["No known allergy"]),
    },
    {
      id: "q27c", n: 23, tag: "conditional", type: "text", label: "Other allergen",
      showIf: (a) => has(a, "q27", "Other"),
    },
    {
      id: "q26", n: 23, tag: "clinical", type: "multi",
      label: "Are there other foods that repeatedly cause symptoms?",
      options: [
        "Milk", "Curd", "Paneer", "Wheat or gluten foods", "Fried food", "High-fat food",
        "Spicy food", "Onion", "Garlic", "Dal", "Chickpeas", "Rajma or beans", "Soy", "Eggs",
        "Seafood", "Nuts", "Artificial sweeteners", "Protein powder",
        "No repeated discomfort", "Other",
      ],
      note: "Allergies belong in the previous question — this is intolerance and digestive-trigger territory.",
    },
    {
      id: "q26a", n: 23, tag: "conditional", type: "multi", label: "Reaction / symptoms",
      options: [
        "Bloating", "Gas", "Acidity", "Reflux", "Pain", "Nausea", "Loose stools",
        "Constipation", "Skin reaction", "Other",
      ],
      showIf: (a) => hasOther(a, "q26", ["No repeated discomfort"]),
    },
    {
      id: "q26d", n: 23, tag: "conditional", type: "single", label: "Frequency of the reaction",
      options: ["Rare", "1–2 times per week", "3–5 times per week", "Daily", "Multiple times daily"],
      showIf: (a) => hasOther(a, "q26", ["No repeated discomfort"]),
    },
    {
      id: "q26b", n: 23, tag: "conditional", type: "single", label: "Reproducibility",
      options: ["Almost every time", "Often", "Sometimes", "Client is unsure"],
      showIf: (a) => hasOther(a, "q26", ["No repeated discomfort"]),
      why: "A food that reacts almost every time is excluded; one that reacts sometimes is retested with a smaller portion.",
    },
    {
      id: "q26c", n: 23, tag: "conditional", type: "text", label: "Other trigger foods",
      showIf: (a) => has(a, "q26", "Other"),
    },
  ],
};

// ---------------------------------------------------------------------------
// STAGE 6 — DETAILED DIETARY INTAKE & HABITUAL FOOD PATTERN (Q24–Q29)
//
// Occasion keys are kept from the current bank wherever the occasion survived,
// so the per-occasion answer keys (q28_lunch_food and friends) keep pointing at
// the same meal. Only the display labels follow v3.0.
// ---------------------------------------------------------------------------

export { MEAL_OCCASIONS } from "./meal-occasions";
import { MEAL_OCCASIONS } from "./meal-occasions";

const PREPARATION = [
  "Raw", "Boiled", "Steamed", "Grilled", "Roasted", "Air fried", "Shallow fried",
  "Deep fried", "Curry", "Dry preparation", "Baked", "Mixed preparation", "Unknown",
];
const FOOD_SOURCE = [
  "Home", "Office or canteen", "Restaurant", "Delivery", "Tiffin", "Hostel or PG",
  "Packaged", "Other",
];
const EXTRA_COMPONENTS = [
  "Oil", "Ghee", "Butter", "Sugar", "Milk", "Sauce", "Dressing", "Chutney", "Pickle", "None",
];

function mealTimelineQuestions(): Question[] {
  const out: Question[] = [];
  for (const { key, label } of MEAL_OCCASIONS) {
    const show = (a: Answers) => has(a, "q28", label);
    out.push(
      {
        id: `q28_${key}_time`, n: 24, tag: "conditional", type: "time",
        label: `${label} — exact or approximate time`, showIf: show,
      },
      {
        // Tap-to-count staples. Offered BEFORE the free text because this is
        // the one that carries the client's carbohydrate: everything the
        // estimate needs can be recorded here without typing a word.
        id: stapleQuestionId(key), n: 24, tag: "conditional", type: "portions",
        label: `${label} — staples and how many`,
        options: STAPLE_LABELS,
        note:
          "Tap a staple, then set how many. This is what the carb and calorie " +
          "estimate counts — anything recorded here does not need writing below.",
        showIf: show,
      },
      {
        // Required only until the staples are picked, so a dietitian who
        // prefers tapping is never blocked on typing. Still the place for
        // everything the picker cannot hold — tea with sugar, a named sabzi,
        // outside food — and it is what the model reads as the food day.
        id: `q28_${key}_food`, n: 24, tag: "conditional", type: "textarea",
        required: (a: Answers) => list(a, stapleQuestionId(key)).length === 0,
        label: `${label} — anything else, with quantity`,
        placeholder: "e.g. tea with 1 tsp sugar · bhindi sabzi 1 katori · 2 samosas",
        probe: "Hunger before the meal, if useful.",
        showIf: show,
      },
      {
        id: `q28_${key}_prep`, n: 24, tag: "conditional", type: "multi",
        label: `${label} — cooking method`, options: PREPARATION, showIf: show,
      },
      {
        // Doubles as v3.0's "Location" — where the food came from and where it
        // was eaten are the same answer for almost every occasion.
        id: `q28_${key}_source`, n: 24, tag: "conditional", type: "single",
        label: `${label} — food source`, options: FOOD_SOURCE, showIf: show,
      },
      {
        id: `q28_${key}_extras`, n: 24, tag: "conditional", type: "multi",
        label: `${label} — added oil/ghee, sugar, sauces & condiments`,
        options: EXTRA_COMPONENTS, showIf: show,
      },
      {
        id: `q28_${key}_beverage`, n: 24, tag: "conditional", type: "text",
        label: `${label} — beverage`,
        placeholder: "e.g. tea with 1 tsp sugar; buttermilk; water only",
        showIf: show,
      },
      {
        id: `q28_${key}_unplanned`, n: 24, tag: "conditional", type: "single",
        label: `${label} — planned or unplanned?`,
        options: ["Planned", "Unplanned", "Partly unplanned"],
        showIf: show,
      }
    );
  }
  return out;
}

const S6: Section = {
  id: "foodday",
  code: "6",
  title: "Detailed dietary intake & habitual food pattern",
  stage: "Diet",
  minutes: "14–16 min",
  intro:
    "Q24 is yesterday, occasion by occasion, waking to sleeping. Q25 is what a normal week looks like. Both are needed — one recalled day is not habitual intake and must not be treated as the client's usual calories.",
  questions: [
    {
      id: "q28", n: 24, tag: "core", type: "multi", required: true,
      label: "Eating occasions during the previous complete day",
      options: MEAL_OCCASIONS.map((o) => o.label),
      note: "Include tasting while cooking, small bites and anything drunk — these are the occasions clients leave out unless asked by name.",
    },
    ...mealTimelineQuestions(),
    {
      id: "q109", n: 25, tag: "core", type: "textarea", required: true,
      label: "Now describe what you normally eat on a typical weekday, meal by meal",
      placeholder:
        "Per usual meal: time · food · typical quantity · preparation · source · how many days a week.",
      why: "The recall says what happened yesterday; this says what happens most days, and the calorie estimate is built from this one.",
    },
    {
      id: "q109a", n: 25, tag: "core", type: "multi",
      label: "Which meals are usually skipped, delayed or replaced?",
      options: [
        "Breakfast usually skipped", "Breakfast usually delayed", "Breakfast usually replaced",
        "Mid-morning usually skipped", "Lunch usually skipped", "Lunch usually delayed",
        "Lunch usually replaced", "Evening snack usually skipped", "Dinner usually skipped",
        "Dinner usually delayed", "Dinner usually replaced", "No meal is regularly missed",
      ],
    },
    {
      id: "q30", n: 26, tag: "core", type: "multi",
      label: "How does your eating and activity usually change on weekends or holidays?",
      options: [
        "Wake-up Time", "Breakfast", "Meal Timing", "Portion Sizes", "Number of Meals",
        "Outside Food", "Restaurant/Delivery", "Snacks", "Sweets", "Alcohol",
        "Late-Night Eating", "Protein Intake", "Total Activity",
      ],
      note: "Select what differs from a weekday, then describe the direction of each change while asking.",
    },
    {
      id: "q30a", n: 26, tag: "planning", type: "single", label: "Weekend difference",
      options: ["No Meaningful Difference", "Mild Difference", "Moderate Difference", "Major Difference"],
    },
    {
      id: "q30b", n: 26, tag: "planning", type: "single", label: "Potential weekend calorie impact",
      options: ["Lower", "Similar", "Moderately Higher", "Significantly Higher", "Unable to Estimate"],
      why: "Two heavy weekend days can erase a whole week's deficit — the weekend has to be planned, not ignored.",
    },
    {
      id: "q29", n: 27, tag: "core", type: "single", required: true,
      label: "How consistent is this eating pattern from week to week?",
      options: [
        "Very Consistent", "Weekdays Are Usually Consistent", "Weekends Are Significantly Different",
        "Intake Changes Every Day", "Work Schedule Changes My Food",
        "Travel Frequently Changes My Food", "I Eat Differently When Stressed",
        "I Eat Differently Around Workouts", "No Consistent Pattern",
      ],
    },
    {
      id: "q29a", n: 27, tag: "planning", type: "single", label: "Habitual intake confidence",
      options: ["High", "Moderate", "Low", "Additional Dietary Recall Required"],
      note: "Estimate calories from the habitual pattern and several data points. One reported day on its own does not support a calorie target.",
    },
    {
      id: "q110", n: 28, tag: "core", type: "multi",
      label: "What cooking fats and additions are commonly used in your household?",
      options: [
        "Ghee", "Butter", "Oil", "Cheese", "Mayonnaise", "Sauces", "Chutney", "Pickle", "Sugar",
        "Honey", "Jaggery", "Cream", "None",
      ],
      why: "Household cooking fat is the single biggest hidden calorie source in an Indian kitchen and never appears in a food recall.",
    },
    {
      id: "q110a", n: 28, tag: "conditional", type: "textarea",
      label: "Frequency and approximate quantity of the selected items",
      placeholder: "e.g. ghee 1 tsp per roti, daily; pickle most lunches; cream in weekend gravies",
      showIf: (a) => hasOther(a, "q110", ["None"]),
    },
    { id: "q110b", n: 28, tag: "core", type: "text", label: "Cooking oil type", placeholder: "e.g. mustard, refined sunflower, ghee" },
    {
      id: "q110c", n: 28, tag: "core", type: "text", label: "Approximate household oil usage",
      placeholder: "e.g. 5 litre tin per month",
    },
    { id: "q110d", n: 28, tag: "core", type: "number", label: "Number of people sharing food" },
    {
      id: "q110e", n: 28, tag: "planning", type: "text", label: "Estimated per-person oil usage",
      placeholder: "e.g. ~28 ml/day",
      note: "Household tin ÷ people ÷ days. Rough, but far closer than asking the client how much oil they eat.",
    },
    {
      id: "q110f", n: 28, tag: "core", type: "single", label: "Salt type",
      options: ["Iodized", "Himalayan Pink", "Rock", "Black", "Low Sodium", "Mixed", "Other"],
    },
    {
      id: "q110g", n: 28, tag: "core", type: "multi", label: "Flour types used regularly",
      options: [
        "Wheat", "Multigrain", "Ragi", "Bajra", "Jowar", "Maize", "Oats", "Mixed Millet",
        "Gluten-Free", "Other",
      ],
    },
    {
      id: "q31", n: 29, tag: "core", type: "single", required: true,
      label: "How often do you eat food prepared outside your home?",
      options: [
        "More than once daily", "Daily", "4–6 times weekly", "2–3 times weekly", "Once weekly",
        "1–3 times monthly", "Rarely",
      ],
    },
    {
      id: "q31a", n: 29, tag: "conditional", type: "multi", label: "Main sources",
      options: [
        "Restaurant", "Delivery", "Office or canteen", "College", "Hotel",
        "Business or client meals", "Family meals", "Street food", "Travel food",
      ],
      showIf: (a) => answered(a, "q31") && !is(a, "q31", "Rarely"),
    },
    {
      id: "q31b", n: 29, tag: "conditional", type: "textarea", label: "Typical orders and portions",
      placeholder: "e.g. butter chicken + 2 naan; masala dosa; chicken biryani full plate",
      showIf: (a) => answered(a, "q31") && !is(a, "q31", "Rarely"),
    },
    {
      id: "q32", n: 29, tag: "core", type: "multi", required: true,
      label: "Which snacks, beverages, sweets or unplanned eating are part of your routine?",
      options: [
        "Tea", "Coffee", "Added sugar", "Milk beverages", "Juice", "Soft drinks",
        "Diet soft drinks", "Energy drinks", "Biscuits", "Namkeen", "Chips", "Nuts or seeds",
        "Sweets or mithai", "Chocolate", "Desserts", "Sauces", "Dressings", "Pickle", "Chutney",
        "Office snacks", "Food from colleagues or friends", "Tasting while cooking",
        "Children's leftovers", "Late-night bites", "Nothing significant", "Other",
      ],
      why: "Hidden intake — usually where the unexplained calorie gap actually is.",
    },
    {
      id: "q32a", n: 29, tag: "conditional", type: "textarea",
      label: "For each item — frequency, quantity, timing, main source, weekday vs weekend",
      placeholder: "e.g. tea x3/day with 1 tsp sugar; biscuits 4–5 with evening tea; sweets only on weekends",
      showIf: (a) => hasOther(a, "q32", ["Nothing significant"]),
    },
  ],
};

// ---------------------------------------------------------------------------
// STAGE 7 — FOOD PREFERENCES, CULTURAL HABITS & HOUSEHOLD FEASIBILITY (Q30–Q35)
//
// v3.0's Q30 also asks the food pattern (vegetarian / eggetarian / …). That is
// q33 in the protein section, which stays untouched — the protein food list is
// built from it, so it is asked there and not repeated here.
// ---------------------------------------------------------------------------


// Q50 records WHICH protein foods the client eats; these follow-ups record HOW
// OFTEN and HOW MUCH, which is what turns the selection into a measured intake
// (see src/lib/protein-intake.ts). One pair per food, shown whenever that food
// is selected in Q50. Selection is the only condition on purpose: the food
// pattern already narrows what Q50 offers, and gating these on it as well would
// leave a food the dietitian deliberately selected impossible to measure.
function proteinFrequencyQuestions(): Question[] {
  const out: Question[] = [];
  for (const food of PROTEIN_FOODS) {
    const show = (a: Answers) => has(a, "q50", food.label);
    out.push(
      {
        id: freqQuestionId(food.id), tag: "planning", type: "single",
        label: `${food.label} — how often?`,
        options: FREQUENCY_OPTIONS.map((f) => f.label),
        showIf: show,
      },
      {
        id: portionQuestionId(food.id), tag: "planning", type: "single",
        label: `${food.label} — portion each time`,
        // The whole portion, not just its protein: a dietitian choosing "3 or
        // more portions" of chicken curry is committing the client to the fat
        // and calories too, and that should be visible at the moment they
        // choose it rather than only in the panel further down.
        note:
          `Standard portion: ${food.portion} — ${food.proteinPerPortion} g protein · ` +
          `${food.carbsPerPortion} g carbs · ${food.fatPerPortion} g fat · ` +
          `${food.kcalPerPortion} kcal. Leave blank if standard.`,
        options: PORTION_OPTIONS.map((p) => p.label),
        showIf: show,
      }
    );
  }
  return out;
}

// ---------------------------------------------------------------------------

const S7: Section = {
  id: "protein",
  code: "7",
  title: "Food pattern & protein intake",
  stage: "Diet",
  minutes: "5–7 min",
  intro:
    "The food pattern decides which protein foods are offered below. Recording how often and how much of each is what turns this into a measured intake — and the week-1 protein target is built from it, not guessed.",
  questions: [
    {
      id: "q33", n: 33, tag: "core", type: "single",
      label: "What food pattern do you follow?",
      options: [
        "Vegetarian", "Eggetarian", "Vegan", "Non-vegetarian", "Pescatarian",
        "Flexitarian", "Jain", "Other",
      ],
    },
    {
      id: "q50", n: 50, tag: "planning", type: "multi",
      label: "Which protein foods are currently part of your diet?",
      why: "Each one selected here is then measured for frequency and portion, and priced from the food database to estimate current protein intake. The list follows the food pattern recorded in Q33.",
      // Narrowed to the recorded food pattern, so a vegetarian consultation is
      // not a wall of chicken and fish, and nothing at all until Q33 says which
      // pattern applies. Anything already selected still keeps its follow-up
      // rows, even if the pattern is later changed.
      optionsFor: (a) => {
        const foods = foodsForPattern(a);
        return foods.length === 0 ? [] : [...foods.map((f) => f.label), "Other"];
      },
      optionsEmptyHint:
        "Answer “What food pattern do you follow?” at the top of this section first — the protein list is built from it.",
      options: [
        "Milk", "Curd", "Greek or high-protein yogurt", "Buttermilk or chaas", "Paneer",
        "Tofu", "Soy chunks", "Tempeh", "Dal", "Chickpeas or chole", "Rajma or beans",
        "Sprouts", "Roasted chana", "Nuts or seeds", "Eggs", "Chicken", "Fish",
        "Seafood", "Meat", "Protein powder", "Other",
      ],
    },
    ...proteinFrequencyQuestions(),
    {
      id: "q50a", tag: "planning", type: "single",
      label: "Meals per day with a clear protein source",
      options: ["0", "1", "2", "3", "4 or more", "Not sure"],
    },
    {
      id: "q50b", tag: "planning", type: "multi", max: 3, label: "Protein barriers",
      options: [
        "Lack of knowledge", "Vegetarian pattern", "Vegan pattern", "Cooking", "Cost",
        "Digestion", "Taste", "Low appetite", "Availability", "Family food pattern",
        "Work schedule", "Carrying food", "Dislike protein foods", "Become too full",
        "Protein-powder concern", "Kidney or liver concern", "Cultural restriction",
        "No major barrier", "Other",
      ],
    },
  ],
};

const S8: Section = {
  id: "preferences",
  code: "8",
  title: "Food preferences, cultural habits & household feasibility",
  stage: "Diet",
  minutes: "8–10 min",
  intro:
    "Household food first: the plan improves what is already cooked at home rather than introducing a second kitchen. Food pattern is recorded with the protein questions.",
  questions: [
    {
      id: "q34", n: 30, tag: "core", type: "multi", max: 3, required: true,
      label: "What cuisine does your household normally follow?",
      options: [
        "North Indian", "Punjabi", "Gujarati", "Rajasthani", "Maharashtrian", "Bengali",
        "Bihari or Jharkhand", "South Indian", "Kerala-style", "Tamil", "Telugu", "Karnataka",
        "North-East Indian", "Kashmiri", "Indian mixed", "Middle Eastern", "Mediterranean",
        "East Asian", "South-East Asian", "European or Western", "African", "Latin American",
        "Mixed or international", "Other",
      ],
    },
    {
      id: "q34c", n: 30, tag: "planning", type: "multi", label: "Regular staple foods",
      options: [
        "Roti", "Rice", "Paratha", "Bread", "Oats", "Poha", "Upma", "Idli", "Dosa", "Millet",
        "Pasta", "Noodles", "Potato", "Other",
      ],
      why: "Staples anchor the plan — they are portioned and improved, not replaced.",
    },
    {
      id: "q34f", n: 30, tag: "planning", type: "textarea", label: "Frequency of major staples",
      placeholder: "e.g. roti twice daily (3–4 each time); rice at lunch only; poha 2 mornings a week",
    },
    {
      id: "q38", n: 30, tag: "clinical", type: "multi", required: true,
      label: "Cultural or religious food practices",
      options: [
        "No restriction", "Vegetarian household", "Vegan preference", "Jain restrictions",
        "Halal", "Kosher", "No beef", "No pork", "No egg",
        "No non-vegetarian food on selected days", "Fasting practice",
        "Separate cooking not allowed", "Ethical or environmental restriction",
        "Prefer not to answer", "Other",
      ],
    },
    {
      id: "q38a", n: 30, tag: "conditional", type: "multi", label: "On which days?",
      options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      showIf: (a) =>
        has(a, "q38", "No non-vegetarian food on selected days") || has(a, "q38", "Fasting practice"),
    },
    {
      id: "q38b", n: 30, tag: "conditional", type: "multi", label: "What is avoided on those days?",
      options: [
        "Non-vegetarian food", "Eggs", "Onion & garlic", "All animal products",
        "Specific grains (fasting)", "Other",
      ],
      showIf: (a) =>
        has(a, "q38", "No non-vegetarian food on selected days") || has(a, "q38", "Fasting practice"),
    },
    {
      id: "q38c", n: 30, tag: "conditional", type: "text", label: "Day-rule details",
      placeholder: "e.g. Tuesdays & Thursdays — no non-veg or eggs; Navratri fasts",
      showIf: (a) =>
        has(a, "q38", "No non-vegetarian food on selected days") || has(a, "q38", "Fasting practice"),
      note: "These day rules are enforced per weekday in the generated plan, so vague answers produce wrong days.",
    },
    {
      id: "q35", n: 31, tag: "planning", type: "textarea", required: true,
      label: "Which foods do you genuinely enjoy and want to keep? (up to 15, top 5 first)",
      placeholder: "e.g. rajma chawal, paneer bhurji, masala dosa, filter coffee, fruit chaat …",
      why: "Favourite foods are retained wherever clinically possible — a plan that deletes all of them is abandoned in week two.",
      note: RANK_NOTE,
    },
    {
      id: "q36", n: 32, tag: "planning", type: "textarea",
      label: "Which foods do you dislike, avoid or never want included?",
      placeholder: "e.g. lauki, karela, tinda",
      note: "Allergies and intolerances belong in Stage 5 — do not repeat them here.",
    },
    {
      id: "q36a", n: 32, tag: "conditional", type: "single", label: "Classify",
      options: [
        "Mild Dislike", "Strong Dislike", "Never Eat", "Religious Restriction",
        "Ethical Restriction",
      ],
      showIf: (a) => answered(a, "q36"),
    },
    {
      id: "q37", n: 33, tag: "planning", type: "multi", max: 5, required: true,
      label: "Which foods or eating habits are non-negotiable for you? (rank top 5)",
      options: [
        "Tea", "Coffee", "Rice", "Roti", "Bread", "Milk", "Sweets or dessert", "Chocolate",
        "Weekend restaurant meal", "Social meal", "Traditional household food",
        "Current breakfast", "Evening snack", "Late dinner due to routine",
        "No strong non-negotiable", "Other",
      ],
      note: RANK_NOTE,
      why: "Non-negotiables stay in the plan. The meal around them is improved; they are not deleted.",
    },
    {
      id: "q39", n: 34, tag: "core", type: "multi", required: true,
      label: "Who is the primary meal preparer in your household?",
      options: [
        "Self", "Spouse or partner", "Parent or family", "Cook or helper", "PG or hostel kitchen",
        "Office or canteen", "Tiffin service", "Restaurant or delivery", "Varies",
      ],
    },
    {
      id: "q39a", n: 34, tag: "planning", type: "single", label: "Control over food choices",
      options: ["High", "Moderate", "Low"],
    },
    {
      id: "q39b", n: 34, tag: "planning", type: "single", label: "Ability to request modifications",
      options: ["Yes", "Sometimes", "No"],
      why: "Low control plus no ability to request changes means the plan must work with the food already being cooked.",
    },
    {
      id: "q39c", n: 34, tag: "planning", type: "text", label: "Relevant household limitations",
      placeholder: "e.g. one common gravy for six people; cook leaves by 8 AM",
    },
    {
      id: "q40", n: 35, tag: "core", type: "multi", label: "Facilities available",
      options: [
        "Full Kitchen", "Basic Kitchen", "Refrigerator", "Freezer", "Microwave",
        "Office Refrigerator", "Office Microwave", "Meal Carrying Capability", "Other",
      ],
    },
    {
      id: "q41", n: 35, tag: "planning", type: "multi", required: true,
      label: "Realistic meal preparation",
      options: [
        "Daily Cooking", "Simple Cooking", "Batch Cooking", "Weekly Prep", "Family Help",
        "Very Limited", "No Extra Cooking", "Max 5 Minutes", "Max 10–15 Minutes",
        "Max 30 Minutes",
      ],
      why: "Everything the plan asks the client to cook has to fit inside this answer, or it will not be cooked.",
    },
  ],
};

// ---------------------------------------------------------------------------
// STAGE 8 — DAILY ACTIVITY & ENHANCED NEAT ASSESSMENT (Q36–Q39)
//
// Almost all new. The current bank had one activity dropdown and a step count;
// v3.0 wants sitting, standing, occupation, commute, household movement and the
// weekday/weekend split, because two clients with the same step count can differ
// by several hundred calories a day on everything else.
// ---------------------------------------------------------------------------

const S9: Section = {
  id: "neat",
  code: "9",
  title: "Daily activity & NEAT",
  stage: "Lifestyle",
  minutes: "5–6 min",
  questions: [
    {
      id: "q54c", n: 36, tag: "core", type: "single", required: true,
      label: "Outside planned exercise, how active are you during a normal day?",
      options: ["Mostly seated", "Lightly active", "Moderately active", "Active", "Highly physical"],
    },
    {
      id: "q111", n: 36, tag: "core", type: "single", label: "Sitting time",
      options: ["<4 Hours", "4–6 Hours", "6–8 Hours", "8–10 Hours", ">10 Hours", "Variable", "Don't Know"],
    },
    {
      id: "q111a", n: 36, tag: "core", type: "single", label: "Standing or moving time",
      options: ["<1 Hour", "1–2 Hours", "2–4 Hours", "4–6 Hours", ">6 Hours", "Variable"],
    },
    {
      id: "q111b", n: 36, tag: "core", type: "text", label: "Occupational movement",
      placeholder: "e.g. shop floor rounds twice a day; site visits 3 days a week",
    },
    {
      id: "q111c", n: 36, tag: "core", type: "text", label: "Household movement",
      placeholder: "e.g. cooking and cleaning for five, school runs on foot",
    },
    {
      id: "q111d", n: 36, tag: "core", type: "text", label: "Other routine movement",
      placeholder: "e.g. evening walk with the dog, stairs to a 4th-floor flat",
    },
    {
      id: "q54e", n: 37, tag: "core", type: "single", label: "Usual commute pattern",
      options: ["Work From Home", "Walking", "Cycling", "Public Transport", "Car", "Two-Wheeler", "Mixed"],
    },
    {
      id: "q54g", n: 37, tag: "core", type: "text", label: "Total daily commute",
      placeholder: "e.g. 80 minutes each way",
    },
    {
      id: "q54h", n: 37, tag: "core", type: "single", label: "Walking involved",
      options: ["Minimal", "<15 Minutes", "15–30 Minutes", "30–60 Minutes", ">60 Minutes"],
      why: "Commute walking is often the only movement a desk-based client has, and it disappears the moment they switch to working from home.",
    },
    {
      id: "q106", n: 38, tag: "core", type: "single", required: true,
      label: "Average daily step count",
      options: [
        "<3,000", "3,000–5,000", "5,000–8,000", "8,000–10,000", "10,000–12,000", ">12,000",
        "Don't Know",
      ],
    },
    {
      id: "q54f", n: 38, tag: "core", type: "single", label: "Tracking source",
      options: ["Phone", "Smartwatch", "Fitness Tracker", "Estimate"],
      note: "A phone in a pocket undercounts and an estimate is a guess — neither should be treated as measured data.",
      showIf: (a) => answered(a, "q106") && !is(a, "q106", "Don't Know"),
    },
    { id: "q112", n: 39, tag: "core", type: "number", label: "Weekday steps" },
    { id: "q112a", n: 39, tag: "core", type: "number", label: "Weekend steps" },
    {
      id: "q112b", n: 39, tag: "core", type: "single", label: "Weekend activity compared with weekday",
      options: ["Much Lower", "Slightly Lower", "Similar", "Slightly Higher", "Much Higher", "Variable"],
    },
    {
      id: "q112c", n: 39, tag: "core", type: "single", label: "Weekend sitting time compared with weekday",
      options: ["Much Higher", "Slightly Higher", "Similar", "Lower", "Variable"],
    },
    {
      id: "q112d", n: 39, tag: "planning", type: "single", label: "NEAT classification",
      options: ["Very Low NEAT", "Low NEAT", "Moderate NEAT", "High NEAT", "Very High NEAT"],
      note: "Judge on steps plus sitting, standing, occupation, commute, household movement and the weekday/weekend difference — not steps alone.",
    },
    {
      id: "q112e", n: 39, tag: "planning", type: "single", label: "NEAT confidence",
      options: ["High", "Moderate", "Low"],
    },
  ],
};

// ---------------------------------------------------------------------------
// STAGE 9 — EXERCISE, TRAINING & RECOVERY (Q40–Q42, Q44–Q45)
//
// v3.0's Q43 (protein sources, meals per day, distribution, barriers) is already
// the protein section — q50, q50a and q50b — and is not redrafted here. The
// untouched protein section belongs immediately after this stage.
// ---------------------------------------------------------------------------

const isTraining = (a: Answers) => hasOther(a, "q43", ["Currently not exercising"]);

const S10: Section = {
  id: "training",
  code: "10",
  title: "Exercise, training & recovery",
  stage: "Fitness",
  minutes: "8–10 min",
  questions: [
    {
      id: "q43", n: 40, tag: "fitness", type: "multi", required: true,
      label: "Tell me about your current exercise or training routine.",
      options: [
        "Starting with LeanR PT", "Strength training", "Cardio machines", "Running", "Walking",
        "Yoga", "Pilates", "Swimming", "Cycling", "Sports", "Home workout", "HIIT",
        "Group classes", "Rehabilitation exercise", "Currently not exercising", "Other",
      ],
    },
    {
      id: "q44a", n: 40, tag: "fitness", type: "single", label: "Days per week",
      options: ["0", "1", "2", "3", "4", "5", "6", "7", "Variable"],
      showIf: isTraining,
    },
    {
      id: "q44b", n: 40, tag: "fitness", type: "single", label: "Duration",
      options: [
        "Less than 30 minutes", "30–45 minutes", "45–60 minutes", "60–90 minutes",
        "More than 90 minutes", "Variable",
      ],
      showIf: isTraining,
    },
    {
      id: "q44c", n: 40, tag: "fitness", type: "single", label: "Timing",
      options: ["Early morning", "Morning", "Afternoon", "Evening", "Night", "Variable"],
      showIf: isTraining,
      why: "Training time decides where the carbohydrate and protein go, not just how much.",
    },
    {
      id: "q44g", n: 40, tag: "fitness", type: "single", label: "Location",
      options: ["Gym", "Home", "Outdoor", "Mixed"],
      showIf: isTraining,
    },
    {
      id: "q44d", n: 40, tag: "fitness", type: "single", required: true, label: "Training experience",
      options: [
        "Complete beginner", "Less than 6 months", "6–12 months", "1–3 years",
        "More than 3 years", "Returning after a break",
      ],
    },
    {
      id: "q44e", n: 40, tag: "fitness", type: "single", label: "Intensity",
      options: ["Very light", "Light", "Moderate", "Hard", "Very hard", "Variable", "Not sure"],
      showIf: isTraining,
    },
    {
      id: "q45", n: 41, tag: "fitness", type: "multi",
      label: "How do you feel during exercise?",
      options: [
        "Good energy", "Low energy before starting", "Energy drops early", "Energy drops midway",
        "Excessive hunger", "Weakness", "Dizziness", "Nausea", "Cramps",
        "Unusual breathlessness", "Headache", "Shakiness", "Too full or heavy",
        "No major problem", "Other",
      ],
      showIf: isTraining,
      note: "Dizziness, unusual breathlessness or shakiness during training is a clinical signal, not a fuelling detail.",
    },
    {
      id: "q46", n: 41, tag: "fitness", type: "multi",
      label: "How do you feel after exercise and between sessions?",
      options: [
        "Recover well", "Mild normal soreness", "Excessive soreness", "Soreness for several days",
        "Persistent fatigue", "Strength declining", "Performance declining", "Poor sleep",
        "Excessive hunger", "Low appetite", "Frequent cramps", "Feel dehydrated", "Other",
      ],
      showIf: isTraining,
    },
    {
      id: "q47", n: 42, tag: "fitness", type: "multi", label: "Before training",
      options: [
        "Full meal", "Small meal", "Snack", "Fruit or carbohydrate source", "Protein food",
        "Protein shake", "Pre-workout supplement", "Caffeine", "Water only", "Train fasted",
        "Variable",
      ],
      showIf: isTraining,
    },
    {
      id: "q47a", n: 42, tag: "fitness", type: "single", label: "How long before training?",
      options: [
        "Less than 30 minutes before", "30–60 minutes before", "1–2 hours before",
        "2–3 hours before", "More than 3 hours before",
      ],
      showIf: (a) => isTraining(a) && hasOther(a, "q47", ["Train fasted", "Water only"]),
    },
    {
      id: "q48", n: 42, tag: "fitness", type: "multi", label: "During training",
      options: [
        "Nothing", "Water", "Electrolytes", "Sports drink", "Carbohydrate drink or gel",
        "BCAA or EAA", "Other supplement", "Food",
      ],
      showIf: isTraining,
    },
    {
      id: "q49", n: 42, tag: "fitness", type: "multi", label: "After training",
      options: [
        "Full meal", "Small meal", "Protein-rich food", "Protein shake",
        "Fruit or carbohydrate source", "Milk or dairy beverage", "Water only",
        "Nothing for several hours", "Variable",
      ],
      showIf: isTraining,
    },
    {
      id: "q49a", n: 42, tag: "fitness", type: "single", label: "How soon after training?",
      options: ["Less than 30 minutes", "30–60 minutes", "1–2 hours", "2–3 hours", "More than 3 hours"],
      showIf: (a) => isTraining(a) && hasOther(a, "q49", ["Nothing for several hours"]),
    },
    {
      id: "q51", n: 44, tag: "clinical", type: "multi", required: true,
      label: "Do you currently use any supplements?",
      options: [
        "Protein powder", "Creatine", "Pre-workout", "BCAA or EAA", "Electrolytes",
        "Mass gainer", "Fat burner", "Multivitamin", "Vitamin D", "Vitamin B12", "Iron",
        "Calcium", "Omega-3", "Magnesium", "Herbal or Ayurvedic product", "None", "Other",
      ],
    },
    {
      id: "q51c", n: 44, tag: "conditional", type: "textarea",
      label: "For each — product, dose, frequency, purpose",
      placeholder: "e.g. whey 1 scoop post-workout daily; Vitamin D 60k IU weekly for deficiency",
      showIf: (a) => hasOther(a, "q51", ["None"]),
    },
    {
      id: "q51a", n: 44, tag: "conditional", type: "single", label: "Recommended by",
      options: ["Doctor", "Dietitian", "Personal Trainer", "Friend or family", "Social media", "Self", "Other"],
      showIf: (a) => hasOther(a, "q51", ["None"]),
    },
    {
      id: "q51b", n: 44, tag: "conditional", type: "multi", label: "Side effects",
      options: ["None", "Digestive issue", "Headache", "Sleep issue", "Palpitations", "Skin issue", "Other"],
      showIf: (a) => hasOther(a, "q51", ["None"]),
    },
    {
      id: "q53", n: 45, tag: "fitness", type: "multi", required: true,
      label: "Do you have any pain, injury or movement limitations affecting exercise?",
      options: [
        "Knee", "Lower back", "Upper back", "Neck", "Shoulder", "Elbow or wrist", "Hip",
        "Ankle or foot", "Previous fracture", "Post-surgery limitation",
        "Medically restricted movement", "No limitation", "Other",
      ],
    },
    {
      id: "q53c", n: 45, tag: "conditional", type: "single", label: "Severity",
      options: ["Mild", "Moderate", "Severe", "Variable"],
      showIf: (a) => hasOther(a, "q53", ["No limitation"]),
    },
    {
      id: "q53d", n: 45, tag: "conditional", type: "single", label: "Duration",
      options: ["Less than 1 month", "1–3 months", "3–6 months", "6–12 months", "More than 1 year"],
      showIf: (a) => hasOther(a, "q53", ["No limitation"]),
    },
    {
      id: "q53e", n: 45, tag: "conditional", type: "text", label: "Activities affected",
      placeholder: "e.g. cannot squat below parallel; stairs painful after 10 minutes",
      showIf: (a) => hasOther(a, "q53", ["No limitation"]),
    },
    {
      id: "q53a", n: 45, tag: "conditional", type: "single", label: "Professional assessment",
      options: ["Doctor", "Physiotherapist", "Personal Trainer", "Self-observed", "Not assessed"],
      showIf: (a) => hasOther(a, "q53", ["No limitation"]),
    },
    // CARRIED OVER from the pre-v3.0 bank. v3.0 Section 1 has no equivalent,
    // and each of these is the sole trigger for a clinical red flag that would
    // otherwise stop firing entirely (see scripts/tests/clinical-rules.test.mts).
    {
      id: "q52", n: 52, tag: "clinical", type: "multi",
      label: "Have you noticed any signs that your body may not be fuelling or recovering well?",
      options: [
        "Persistent tiredness", "Feeling unusually cold", "Frequent illness", "Frequent injuries",
        "Stress fracture or bone injury", "Declining performance", "Loss of strength",
        "Poor recovery", "Difficulty concentrating", "Significant irritability or mood change",
        "Reduced sex drive", "Menstrual cycle irregular or stopped", "Unintentional weight loss",
        "Training while eating very little", "Fear of increasing food despite high training",
        "None", "Other",
      ],
      why: "Under-fuelling screen (RED-S) — changes the energy strategy.",
    },
    {
      id: "q52a", tag: "conditional", type: "multi", label: "Did this coincide with…",
      options: [
        "Increased training", "Reduced food intake", "Rapid weight loss", "Increased stress",
        "Poor sleep", "Illness", "Not sure",
      ],
      showIf: (a) => hasOther(a, "q52", ["None"]),
    },
  ],
};

// ---------------------------------------------------------------------------
// STAGE 10 — HUNGER & EATING BEHAVIOUR (Q46–Q52)
// ---------------------------------------------------------------------------

const S11: Section = {
  id: "routine",
  code: "11",
  title: "Hunger & eating behaviour",
  stage: "Behaviour",
  minutes: "6–8 min",
  questions: [
    {
      id: "q56", n: 46, tag: "core", type: "single", required: true,
      label: "How would you describe your hunger and appetite throughout the day?",
      options: [
        "Stable", "Low hunger most of the day", "High morning hunger", "High lunch hunger",
        "High evening hunger", "High night hunger", "Extreme post-workout hunger",
        "Unpredictable", "Often eat without physical hunger", "Not sure",
      ],
      why: "The appetite phenotype decides where the calories are placed — an evening-hunger client fails a big-breakfast plan.",
    },
    {
      id: "q56a", n: 46, tag: "core", type: "single", label: "Hungriest time",
      options: [
        "Early morning", "Mid-morning", "Lunch", "Afternoon", "Evening", "Night", "Post-workout",
        "Variable",
      ],
    },
    {
      id: "q56b", n: 46, tag: "core", type: "multi", label: "Low-appetite periods",
      options: [
        "Early morning", "Mid-morning", "Lunch", "Afternoon", "Evening", "Night",
        "Immediately after training", "During stress", "No low-appetite period",
      ],
    },
    {
      id: "q57", n: 46, tag: "core", type: "multi", label: "Appetite variability",
      options: [
        "Good", "Very strong", "Low", "Variable", "Become full quickly",
        "Struggle to finish meals", "Forget to eat", "Delay eating despite hunger",
        "Hungry but not interested in food", "Reduced after training", "Increased after training",
        "Reduced by stress", "Increased by stress", "No concern",
      ],
    },
    {
      id: "q55", n: 47, tag: "core", type: "multi", max: 3, required: true,
      label: "Are there particular meals or times of day that are difficult to manage?",
      options: [
        "Early morning", "Breakfast", "Mid-morning", "Lunch", "Afternoon", "Evening",
        "Pre-workout", "Post-workout", "Dinner", "Late night", "Weekend", "Travel",
        "Social events", "No specific time",
      ],
    },
    {
      id: "q55b", n: 47, tag: "conditional", type: "single", label: "How difficult",
      options: ["Slightly difficult", "Moderately difficult", "Very difficult", "Usually goes wrong"],
      showIf: (a) => hasOther(a, "q55", ["No specific time"]),
    },
    {
      id: "q55a", n: 47, tag: "conditional", type: "multi", label: "Reason",
      options: [
        "No time", "No appetite", "Excessive hunger", "Meetings", "No meal break",
        "Food unavailable", "Cannot carry food", "Family routine", "Cravings", "Stress",
        "Commute", "Training timing", "Tiredness", "Cooking difficulty", "Other",
      ],
      showIf: (a) => hasOther(a, "q55", ["No specific time"]),
    },
    {
      id: "q58", n: 48, tag: "core", type: "multi", required: true,
      label: "What food cravings do you experience?",
      options: [
        "Sweets or mithai", "Chocolate", "Bakery foods", "Fried foods", "Salty snacks",
        "Chips or namkeen", "Fast food", "Carbohydrate-rich foods", "Sugary drinks",
        "Tea or coffee", "Late-night food", "No strong cravings", "Other",
      ],
    },
    {
      id: "q58a", n: 48, tag: "conditional", type: "multi", max: 3, label: "Trigger",
      options: [
        "Hunger", "Stress", "Boredom", "Poor sleep", "Menstrual cycle", "Previous restriction",
        "Social situation", "Food cues", "Work pressure", "Habit", "Post-workout", "Other",
      ],
      showIf: (a) => hasOther(a, "q58", ["No strong cravings"]),
      why: "A craving driven by previous restriction is fixed by feeding more, not by more willpower.",
    },
    {
      id: "q58b", n: 48, tag: "conditional", type: "single", label: "Timing",
      options: ["Morning", "Afternoon", "Evening", "Late night", "Post-workout", "Variable"],
      showIf: (a) => hasOther(a, "q58", ["No strong cravings"]),
    },
    {
      id: "q58c", n: 48, tag: "conditional", type: "single", label: "Frequency",
      options: ["Rarely", "1–2 times per week", "3–5 times per week", "Daily", "Multiple times daily"],
      showIf: (a) => hasOther(a, "q58", ["No strong cravings"]),
    },
    {
      id: "q59", n: 49, tag: "core", type: "multi",
      label: "How do stress and emotions affect your eating?",
      options: [
        "Eat More", "Eat Less", "Crave Specific Foods", "Snack More", "Skip Meals",
        "Order Outside Food", "No Significant Effect", "Variable", "Other",
      ],
    },
    {
      id: "q60", n: 50, tag: "clinical", type: "multi", required: true,
      label: "Have you experienced any concerning eating behaviours?",
      // v3.0 leaves this open text. The named patterns are kept because the
      // disordered-eating stop is triggered from them, and an open box gives the
      // safety check nothing to read.
      options: [
        "Feeling unable to control eating", "Eating an unusually large amount with distress",
        "Severe or prolonged food restriction", "Skipping meals to compensate",
        "Significant guilt after eating", "Anxiety after eating", "Strong fear of specific foods",
        "Self-induced vomiting", "Other compensatory behaviour",
        "Professionally diagnosed eating disorder", "Currently receiving professional support",
        "None", "Prefer not to answer",
      ],
      note: "Ask sensitively, record only what is offered, and never intensify restriction where any of this is present.",
    },
    {
      id: "q60a", n: 50, tag: "clinical", type: "single", label: "Dietitian assessment",
      options: [
        "No Concern", "Explore Further", "Senior Clinical Review",
        "Mental Health Professional Referral", "Avoid Aggressive Restriction",
      ],
      showIf: (a) => hasOther(a, "q60", ["None"]),
    },
    {
      id: "q113", n: 51, tag: "core", type: "single", label: "Eating speed",
      options: ["Very Fast", "Fast", "Moderate", "Slow"],
      why: "Fast, distracted eating means fullness signals arrive after the plate is empty — a portion problem no calorie target fixes on its own.",
    },
    {
      id: "q113a", n: 51, tag: "core", type: "multi", label: "Common distractions",
      options: ["Phone", "TV", "Work", "Driving", "Conversation", "None", "Other"],
    },
    {
      id: "q113b", n: 51, tag: "core", type: "single", label: "Why do you usually finish a meal?",
      options: [
        "Comfortable Fullness", "Plate Is Empty", "Still Hungry", "Habit", "Food Is Available",
        "Don't Want to Waste Food", "Emotional Satisfaction", "Not Sure", "Other",
      ],
    },
    {
      // Was a multi-select of off-plan behaviours; v3.0 asks for the single
      // closest pattern, which is what the all-or-nothing phenotype is read from.
      id: "q69", n: 52, tag: "core", type: "single", required: true,
      label: "When following a nutrition plan, what usually happens when things do not go as planned?",
      options: [
        "I Adjust and Continue Normally", "I Return to the Plan at the Next Meal",
        "I Usually Give Up for the Rest of the Day", "I May Go Off-Plan for Several Days",
        "I Feel Guilty and Restrict Later", "I Compensate With Extra Exercise",
        "I Tend to Follow an All-or-Nothing Pattern", "It Depends on the Situation", "Not Sure",
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// STAGE 11 — SLEEP, STRESS, HYDRATION & LIFESTYLE (Q53–Q58)
// ---------------------------------------------------------------------------

const S12: Section = {
  id: "lifestyle",
  code: "12",
  title: "Sleep, stress, hydration & lifestyle",
  stage: "Lifestyle",
  minutes: "6–7 min",
  questions: [
    { id: "q61d", n: 53, tag: "core", type: "time", label: "Bedtime" },
    { id: "q61e", n: 53, tag: "core", type: "time", label: "Wake time" },
    {
      id: "q61", n: 53, tag: "core", type: "single", required: true, label: "Average sleep duration",
      options: [
        "Less than 5 hours", "5–6 hours", "6–7 hours", "7–8 hours", "8–9 hours",
        "More than 9 hours", "Variable",
      ],
    },
    { id: "q61a", n: 53, tag: "core", type: "scale10", required: true, label: "Sleep quality (1–10)" },
    {
      id: "q61c", n: 53, tag: "clinical", type: "multi", label: "Sleep problems",
      options: [
        "Difficulty falling asleep", "Frequent waking", "Wake too early", "Heavy snoring",
        "Observed breathing pauses", "Daytime sleepiness", "Shift-related sleep issue",
        "Late caffeine", "Training affects sleep", "No major concern", "Other",
      ],
      note: "Snoring plus observed breathing pauses plus daytime sleepiness is a sleep-apnoea picture worth naming to the client.",
    },
    {
      id: "q61f", n: 53, tag: "conditional", type: "single", label: "Night awakenings",
      options: ["None", "Once", "Twice", "Three or more", "Variable"],
      showIf: (a) => hasOther(a, "q61c", ["No major concern"]),
    },
    { id: "q62", n: 54, tag: "core", type: "scale10", required: true, label: "Current stress level (1–10)" },
    {
      id: "q62a", n: 54, tag: "conditional", type: "multi", max: 3, label: "Major stress sources",
      options: [
        "Work", "Business", "Studies", "Financial", "Family", "Relationship", "Health",
        "Body or weight", "Caregiving", "Travel", "Poor sleep", "Other",
      ],
      showIf: (a) => answered(a, "q62"),
    },
    {
      id: "q62b", n: 54, tag: "conditional", type: "multi", label: "Impact on eating, sleep and exercise",
      options: [
        "Food intake", "Cravings", "Meal timing", "Sleep", "Training consistency",
        "Performance", "Digestion", "No noticeable effect",
      ],
      showIf: (a) => answered(a, "q62"),
    },
    {
      id: "q63", n: 55, tag: "core", type: "single", required: true,
      label: "Approximate daily water intake",
      options: [
        "Less than 1 litre", "1–1.5 litres", "1.5–2 litres", "2–3 litres", "More than 3 litres",
        "Not sure",
      ],
      note: "If a fluid restriction was recorded at Q20, that ceiling wins over any hydration target.",
    },
    {
      id: "q63c", n: 55, tag: "core", type: "text", label: "Other fluids",
      placeholder: "e.g. 3 teas, 1 buttermilk, occasional juice",
    },
    {
      id: "q63d", n: 55, tag: "fitness", type: "text", label: "Workout hydration",
      placeholder: "e.g. 500 ml during a 60-minute session",
    },
    {
      id: "q63a", n: 55, tag: "conditional", type: "multi", label: "Factors affecting requirements",
      options: [
        "Hot climate", "Heavy sweating", "Long workouts", "Outdoor training",
        "Endurance exercise", "Physical job", "Frequent travel", "None",
      ],
    },
    {
      id: "q63b", n: 55, tag: "conditional", type: "single", label: "Electrolytes",
      options: ["Regularly", "Sometimes", "Only during long or hard exercise", "Never", "Unsure when required"],
    },
    {
      id: "q64", n: 56, tag: "core", type: "multi", required: true,
      label: "Which caffeinated drinks do you regularly consume?",
      options: ["Tea", "Coffee", "Energy drink", "Pre-workout", "Caffeine tablet", "None"],
    },
    {
      id: "q64a", n: 56, tag: "conditional", type: "number", label: "Quantity (servings per day)",
      showIf: (a) => hasOther(a, "q64", ["None"]),
    },
    {
      id: "q64c", n: 56, tag: "conditional", type: "single", label: "Added sugar",
      options: ["No", "Yes", "Sometimes"],
      showIf: (a) => hasOther(a, "q64", ["None"]),
      why: "Four sugared teas a day is a meal's worth of calories that never appears in a food recall.",
    },
    {
      id: "q64d", n: 56, tag: "conditional", type: "multi", label: "Timing",
      options: ["On waking", "With breakfast", "Mid-morning", "After lunch", "Evening", "Pre-workout", "Night"],
      showIf: (a) => hasOther(a, "q64", ["None"]),
    },
    {
      id: "q64b", n: 56, tag: "conditional", type: "single", label: "Last intake timing",
      options: ["Before 12 PM", "12–3 PM", "3–6 PM", "6–9 PM", "After 9 PM", "Variable"],
      showIf: (a) => hasOther(a, "q64", ["None"]),
    },
    {
      id: "q65", n: 57, tag: "core", type: "multi", required: true,
      label: "Do you consume alcohol, tobacco or nicotine?",
      options: [
        "Alcohol", "Cigarette", "Vaping", "Chewing tobacco", "Other nicotine or tobacco",
        "None", "Prefer not to answer",
      ],
      note: "Record sensitively and without comment — a judged answer here is an inaccurate answer.",
    },
    {
      id: "q65a", n: 57, tag: "conditional", type: "single", label: "Frequency",
      options: ["Daily", "4–6 times weekly", "2–3 times weekly", "Weekly", "Monthly", "Occasionally"],
      showIf: (a) => hasOther(a, "q65", ["None", "Prefer not to answer"]),
    },
    {
      id: "q65c", n: 57, tag: "conditional", type: "text", label: "Quantity",
      placeholder: "e.g. 3–4 pegs of whisky per sitting; 5 cigarettes a day",
      showIf: (a) => hasOther(a, "q65", ["None", "Prefer not to answer"]),
    },
    {
      id: "q65b", n: 57, tag: "conditional", type: "multi", label: "Context",
      options: ["Routine use", "Social", "Weekend", "Stress-related", "Travel", "Other"],
      showIf: (a) => hasOther(a, "q65", ["None", "Prefer not to answer"]),
    },
    {
      id: "q67", n: 58, tag: "core", type: "multi", required: true,
      label: "How often do travel and social situations affect your eating routine?",
      options: [
        "Work travel", "Personal travel", "Flights or airports", "Hotel stays",
        "Business dinners", "Restaurants", "Family gatherings", "Parties or social events",
        "International travel", "Religious or community events", "Rarely affected", "Other",
      ],
    },
    {
      id: "q67b", n: 58, tag: "conditional", type: "single", label: "Frequency",
      options: ["Rarely", "1–2 times per month", "Weekly", "Multiple times per week", "Frequent traveller"],
      showIf: (a) => hasOther(a, "q67", ["Rarely affected"]),
    },
    {
      id: "q67a", n: 58, tag: "conditional", type: "multi", label: "Nutrition impact",
      options: [
        "Skip meals", "Eat very little beforehand", "Overeat", "Drink alcohol",
        "Eat whatever is available", "Struggle with protein", "Eat late",
        "Order familiar foods", "Carry snacks", "Manage reasonably well",
      ],
      showIf: (a) => hasOther(a, "q67", ["Rarely affected"]),
    },
    {
      id: "q67c", n: 58, tag: "conditional", type: "text", label: "Typical challenges",
      placeholder: "e.g. airport food after 10 PM; client dinners three nights a week",
      showIf: (a) => hasOther(a, "q67", ["Rarely affected"]),
    },
  ],
};

// ---------------------------------------------------------------------------
// STAGE 12 — ADHERENCE, MINDSET & SUCCESS STRATEGY (Q59–Q64)
// ---------------------------------------------------------------------------

const S13: Section = {
  id: "coaching",
  code: "13",
  title: "Adherence, mindset & success strategy",
  stage: "Behaviour",
  minutes: "5–6 min",
  intro:
    "This stage decides how the plan is written, not what is in it: structure, portion language, how much change lands in week one and what support the client gets.",
  questions: [
    {
      id: "q73", n: 59, tag: "planning", type: "multi", max: 3, required: true,
      label:
        "Based on your past experience, what could make it difficult to stay consistent with your LeanR plan?",
      options: [
        "Busy Work Schedule", "Travel", "Stress", "Poor Sleep", "Family Responsibilities",
        "Hunger", "Cravings", "Cooking", "Budget", "Food Availability", "Social Events",
        "Low Motivation", "Poor Results", "Digestive Problems", "Other",
      ],
      note: RANK_NOTE,
    },
    {
      id: "q71", n: 60, tag: "core", type: "multi", required: true,
      label: "Are there any nutrition beliefs or food rules that strongly influence how you eat?",
      options: [
        "Carbohydrates cause weight gain", "Rice causes weight gain", "Roti causes weight gain",
        "Avoid food after a specific time", "Skipping meals helps fat loss",
        "Fasting is necessary", "Fruit has too much sugar", "Dietary fat should be avoided",
        "Very high protein is necessary", "Protein damages kidneys or liver",
        "Protein powder is unsafe", "Supplements are necessary", "Detox or cleanse is required",
        "More sweating means more fat loss", "Fasted workout significantly increases fat loss",
        "Social-media nutrition influences choices", "No strong belief affecting choices", "Other",
      ],
      why: "A plan that silently contradicts a strongly held rule gets quietly edited by the client instead of followed.",
    },
    {
      id: "q71b", n: 60, tag: "conditional", type: "multi", label: "Source of belief",
      options: [
        "Social media", "Friends or family", "Previous dietitian", "Personal Trainer", "Doctor",
        "Own experience", "Article or book", "Not sure",
      ],
      showIf: (a) => hasOther(a, "q71", ["No strong belief affecting choices"]),
    },
    {
      id: "q71a", n: 60, tag: "conditional", type: "single", label: "Strength of belief",
      options: ["None", "Mild", "Moderate", "Significant"],
      showIf: (a) => hasOther(a, "q71", ["No strong belief affecting choices"]),
    },
    {
      id: "q71c", n: 60, tag: "conditional", type: "single",
      label: "May it affect adherence or nutrition quality?",
      options: ["No", "Possibly", "Yes — restricts food choices", "Yes — drives under-eating"],
      showIf: (a) => hasOther(a, "q71", ["No strong belief affecting choices"]),
    },
    {
      id: "q72", n: 61, tag: "planning", type: "single", required: true,
      label: "What type of nutrition plan would be easiest for you to follow consistently?",
      options: ["Exact Meal Plan", "Meal Options", "Flexible Exchange", "Portion Guidance", "Combination"],
    },
    {
      id: "q72a", n: 61, tag: "planning", type: "single", label: "Preferred measurement method",
      options: ["Grams", "Household Measures", "Hand Portions", "Visual Portions", "Combination"],
      why: "The plan is written in the client's own measuring language — grams to someone who cooks in katoris is a plan they cannot follow.",
    },
    {
      id: "q74", n: 62, tag: "planning", type: "single", required: true,
      label: "How much change feels realistic for you during the first two weeks?",
      options: [
        "Very Small Changes", "A Few Priority Changes", "Moderate Structured Changes",
        "Comfortable With Significant Changes", "Not Sure – Need Dietitian Guidance",
      ],
    },
    {
      id: "q75", n: 63, tag: "core", type: "scale10", required: true,
      label: "How confident are you that you can follow the agreed nutrition and lifestyle plan? (1–10)",
    },
    {
      id: "q75a", n: 63, tag: "conditional", type: "multi",
      label: "What would make the plan easier to follow?",
      options: [
        "Simpler Meals", "More Food Options", "Less Cooking", "Family-Friendly Meals",
        "Travel Options", "More Accountability", "More Frequent Follow-ups", "Flexible Portions",
        "Better Craving Management", "Other",
      ],
      showIf: (a) => scaleAtMost(a, "q75", 6),
      note: "Below 7 the plan is changed now, not reviewed later — confidence at counselling predicts week-3 dropout.",
    },
    {
      id: "q70", n: 64, tag: "core", type: "multi", max: 3, required: true,
      label: "What type of support and coaching helps you stay most consistent?",
      options: [
        "Clear Step-by-Step Instructions", "Regular Accountability", "Frequent Check-ins",
        "Flexible Guidance", "Strict Structure", "Encouragement and Motivation",
        "Progress Data and Feedback", "Education and Explanation", "Problem-Solving Support",
        "Simple Targets", "Other",
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// v3.0 SECTION 1, in spec order. The untouched protein section (S6 `protein`)
// belongs between Stage 9 and Stage 10 — it answers v3.0 Q30's food pattern and
// the whole of Q43.
// ---------------------------------------------------------------------------


const S14: Section = {
  id: "assessment",
  code: "14",
  title: "Dietitian professional assessment",
  stage: "Assessment",
  minutes: "8–10 min",
  intro:
    "IMPORTANT: these answers are your professional hypothesis, not automatically the final LeanR nutrition strategy. The AI independently analyses the complete client data before accepting, modifying or replacing it.",
  questions: [
    {
      id: "ds1", tag: "planning", type: "textarea",
      label: "Your professional one-sentence understanding of this client",
      placeholder:
        "“This client primarily needs ___ while improving ___ without unnecessarily changing ___.”",
    },
    {
      id: "q76", n: 76, tag: "planning", type: "multi", max: 5,
      label: "Main factors currently limiting the client's progress",
      note: RANK_NOTE,
      options: [
        "Excess energy intake", "Intake appears too low", "Irregular energy intake",
        "Low protein intake", "Poor protein distribution", "Long meal gaps",
        "Frequent meal skipping", "Excessive evening hunger", "Excessive night hunger",
        "Frequent cravings", "Emotional or stress eating", "Weekend overeating",
        "Frequent outside food", "Hidden calorie intake", "Liquid calories", "Alcohol intake",
        "Low physical activity", "Inconsistent training", "Training stimulus may be insufficient",
        "High training demand", "Poor pre-workout fuelling", "Poor post-workout nutrition",
        "Possible under-fuelling", "Poor recovery", "Poor sleep", "High stress",
        "Digestive issues affecting intake", "Food intolerance or discomfort",
        "Medical or clinical consideration", "Medication-related consideration",
        "Restriction-regain cycle", "Low appetite", "Early fullness", "Poor meal planning",
        "Work schedule", "Travel", "Cooking limitation", "Food availability",
        "Budget limitation", "Nutrition misconceptions", "Poor adherence",
        "Goal or timeline appears unrealistic", "Insufficient information", "Other",
      ],
    },
    {
      id: "q77", n: 77, tag: "planning", type: "multi", max: 3,
      label: "Minimum changes most likely to move the client towards the goal",
      options: [
        "Improve meal regularity", "Stop frequent meal skipping", "Increase protein",
        "Improve protein distribution", "Improve breakfast", "Improve lunch",
        "Improve evening snack", "Improve dinner", "Reduce excessive portions",
        "Improve carbohydrate quality", "Improve carbohydrate timing",
        "Improve workout fuelling", "Improve post-workout nutrition",
        "Increase food intake safely", "Improve hydration", "Improve fibre",
        "Increase fruit or vegetable variety", "Reduce outside food frequency",
        "Improve restaurant choices", "Create weekend strategy", "Create travel strategy",
        "Improve sleep routine", "Address cravings", "Address emotional eating",
        "Reduce alcohol", "Improve meal preparation", "Simplify diet",
        "Correct nutrition misconception", "Stabilise intake before fat loss",
        "Clinical nutrition strategy required", "Other",
      ],
    },
    {
      id: "q78", n: 78, tag: "planning", type: "textarea",
      label: "Current foods or habits that should be retained / protected (up to 5)",
      placeholder: "Review the client's favourites (Q35), non-negotiables (Q37) and cultural foods (Q38). Write “none” if nothing requires protection.",
    },
    {
      id: "q79", n: 79, tag: "clinical", type: "multi",
      label: "Is there a risk of unnecessary food restriction?",
      options: [
        "No unnecessary restriction identified", "Client fears carbohydrates",
        "Client fears rice", "Client fears roti", "Client fears fruit",
        "Client fears dietary fat", "Client fears eating after a specific time",
        "Previous restriction-regain cycle", "Client expects an overly strict diet",
        "Client frequently skips meals", "Client compensates after off-plan eating",
        "Food reintroduction may be required", "Senior review required",
      ],
    },
    {
      id: "q80", n: 80, tag: "planning", type: "single",
      label: "Professional transformation objective you recommend",
      options: [
        "Fat loss", "Weight loss", "Fat loss with muscle preservation", "Body recomposition",
        "Muscle gain", "Lean mass gain", "Healthy weight gain", "Performance improvement",
        "Metabolic health improvement", "Plateau management", "Nutrition stabilisation",
        "Further assessment required", "Other",
      ],
    },
    {
      id: "q81", n: 81, tag: "planning", type: "single",
      label: "Transformation phase the client is currently in",
      options: [
        "Nutrition stabilisation or foundation", "Fat-loss phase", "Controlled weight-loss phase",
        "Body-recomposition phase", "Muscle-preservation phase", "Lean-gain phase",
        "Healthy weight-gain phase", "Performance-fuelling phase", "Recovery-support phase",
        "Clinical or metabolic nutrition support", "Maintenance or lifestyle restructuring",
        "Further assessment required",
      ],
    },
    {
      id: "q82a", n: 82, tag: "planning", type: "number",
      label: "Initial weight target you recommend (kg)", note: "Leave blank for no numerical initial target.",
    },
    {
      id: "q82b", tag: "planning", type: "number",
      label: "Long-term weight target (kg)", note: "Leave blank to reassess later / no numerical target.",
    },
    {
      id: "q82c", tag: "planning", type: "single", label: "Assessment of the client's own target",
      options: [
        "Client target appears appropriate", "Client target appears aggressive",
        "Client target appears unrealistic in requested timeline",
        "Initial target should differ from final target", "Weight should not be the primary target",
        "Weight maintenance with recomposition may be preferred", "Weight gain may be appropriate",
        "More assessment required",
      ],
    },
    {
      id: "q83", n: 83, tag: "planning", type: "multi", max: 5,
      label: "Why do you recommend this target?",
      options: [
        "Current weight and height context", "Current body-fat level",
        "Central fat or waist concern", "Muscle-preservation priority", "Muscle-gain priority",
        "Body-recomposition objective", "Previous comfortable weight",
        "Previous sustainable weight", "Previous rapid weight loss", "Previous weight regain",
        "Restriction-regain history", "Current intake appears low", "Current intake appears high",
        "Possible under-fuelling", "Training demand", "Strength objective",
        "Performance objective", "Recovery concern", "Medical condition",
        "Blood-report finding", "Medication consideration",
        "Menstrual or reproductive consideration", "Client timeline appears aggressive",
        "Sustainability concern", "Adherence concern", "More data required", "Other",
      ],
    },
    {
      id: "q83a", tag: "planning", type: "single", label: "Target confidence",
      options: [
        "High — sufficient baseline information", "Moderate — reassess after 2 weeks",
        "Moderate — body-composition data required", "Moderate — blood reports required",
        "Low — initial target only", "Target intentionally not numerically fixed",
      ],
    },
    {
      id: "q84", n: 84, tag: "planning", type: "single",
      label: "Body-composition direction you recommend",
      options: [
        "Reduce body fat", "Reduce fat while preserving muscle",
        "Reduce fat while increasing muscle", "Maintain body fat and increase muscle",
        "Increase lean mass", "Maintain current composition", "Body recomposition",
        "Insufficient data for numerical target", "Trend monitoring preferred",
      ],
    },
    {
      id: "q84a", tag: "planning", type: "text", label: "Body-fat target",
      placeholder: "exact %, range, or “no numerical target”",
    },
    {
      id: "q84b", tag: "planning", type: "single", label: "Muscle direction",
      options: ["Preserve", "Increase", "Monitor", "Insufficient data"],
    },
    {
      id: "q84c", tag: "planning", type: "single", label: "Visceral-fat direction",
      options: ["Reduce", "Maintain", "Monitor", "Insufficient data"],
    },
    {
      id: "q85", n: 85, tag: "planning", type: "multi",
      label: "Measurement targets that are professionally relevant",
      options: [
        "Waist", "Hip", "Chest", "Arm", "Thigh", "Overall inches", "Clothing fit",
        "No measurement target", "Baseline measurement required",
      ],
    },
    {
      id: "q85a", tag: "planning", type: "textarea", label: "Numeric measurement targets",
      placeholder: "e.g. waist 34 → 31 in; overall −4 inches",
      showIf: (a) => hasOther(a, "q85", ["No measurement target", "Baseline measurement required"]),
    },
    {
      id: "q86", n: 86, tag: "fitness", type: "multi", max: 3,
      label: "Fitness or performance objectives that should influence nutrition planning",
      options: [
        "Improve strength", "Improve workout energy", "Improve training performance",
        "Improve training consistency", "Improve stamina", "Improve running performance",
        "Improve sports performance", "Improve recovery", "Reduce workout fatigue",
        "Support hypertrophy", "Maintain performance during fat loss", "Return to training",
        "No specific performance target", "Other",
      ],
    },
    {
      id: "q87a", n: 87, tag: "planning", type: "single", label: "Initial strategy period",
      options: ["1 week", "2 weeks", "3 weeks", "4 weeks"],
    },
    {
      id: "q87b", tag: "planning", type: "single", label: "First reassessment",
      options: ["1 week", "2 weeks", "3 weeks", "4 weeks"],
    },
    {
      id: "q87c", tag: "planning", type: "single", label: "Initial target timeline",
      options: ["4–6 weeks", "6–8 weeks", "8–12 weeks", "3–6 months", "More than 6 months", "Progress dependent"],
    },
    {
      id: "q87d", tag: "planning", type: "single", label: "Long-term transformation period",
      options: [
        "Less than 3 months", "3–6 months", "6–9 months", "9–12 months",
        "More than 12 months", "Cannot estimate yet",
      ],
    },
    {
      id: "q87e", tag: "planning", type: "single", label: "Timeline assessment",
      options: [
        "Client timeline appears realistic", "Aggressive", "Unrealistic", "Keep flexible",
        "Clinical progress dependent", "Training adaptation dependent",
        "Body-composition trend dependent", "Adherence data required",
      ],
    },
    {
      id: "q88", n: 88, tag: "planning", type: "multi", max: 5,
      label: "Markers that should define transformation success",
      note: RANK_NOTE,
      options: [
        "Weight", "Rate of weight change", "Body-fat trend", "Waist", "Overall inches",
        "Progress photographs", "Clothing fit", "Muscle mass", "Strength",
        "Workout performance", "Stamina", "Recovery", "Energy", "Hunger control",
        "Digestive comfort", "Blood markers", "Menstrual or reproductive health",
        "Diet adherence", "Sustainable routine", "Other",
      ],
    },
    {
      id: "q89", n: 89, tag: "planning", type: "single",
      label: "Energy strategy you currently believe is appropriate",
      options: [
        "Controlled energy deficit", "Mild energy deficit", "Maintenance or recomposition",
        "Mild energy surplus", "Controlled energy surplus",
        "Intake stabilisation before deficit or surplus", "Correct excessive restriction first",
        "Performance-fuelling priority", "Clinical stabilisation priority",
        "Unsure — AI clinical review required",
      ],
    },
    {
      id: "q90", n: 90, tag: "planning", type: "single", label: "Muscle priority",
      options: [
        "Standard", "Moderate", "High", "Critical due to restriction or low intake",
        "Muscle gain is primary",
      ],
    },
    {
      id: "q90a", tag: "planning", type: "single", label: "Performance priority",
      options: ["Low", "Moderate", "High", "Primary strategy driver"],
    },
    {
      id: "q91", n: 91, tag: "planning", type: "multi", max: 3,
      label: "First three nutrition priorities you recommend",
      note: RANK_NOTE,
      options: [
        "Meal regularity", "Energy intake", "Protein quantity", "Protein distribution",
        "Breakfast quality", "Lunch quality", "Dinner quality", "Snack structure",
        "Carbohydrate quality", "Carbohydrate timing", "Fat quality", "Fibre",
        "Fruit or vegetable variety", "Hydration", "Workout fuelling", "Post-workout nutrition",
        "Recovery nutrition", "Appetite management", "Hunger management",
        "Craving management", "Digestive strategy", "Weekend strategy", "Travel strategy",
        "Restaurant strategy", "Meal preparation", "Nutrition education",
        "Clinical strategy", "Other",
      ],
    },
    {
      id: "q92", n: 92, tag: "planning", type: "single", label: "Current protein assessment",
      options: [
        "Very low", "Low", "Moderate but poorly distributed",
        "Moderate and reasonably distributed", "Likely adequate", "High", "Unable to assess",
      ],
    },
    {
      id: "q92a", tag: "planning", type: "multi", label: "Main protein gap",
      options: [
        "Total quantity", "Breakfast", "Lunch", "Dinner", "Snack", "Pre-workout",
        "Post-workout", "Vegetarian protein variety", "Availability", "Affordability",
        "Tolerance", "No major gap",
      ],
    },
    {
      id: "q92b", tag: "planning", type: "multi", label: "Recommended protein direction",
      options: [
        "Increase total protein", "Improve distribution", "Improve breakfast protein",
        "Improve lunch protein", "Improve around-training protein",
        "Improve post-workout protein", "Improve dinner protein", "Add high-protein snacks",
        "Improve vegetarian variety", "Consider supplement", "Current pattern appears adequate",
      ],
    },
    {
      id: "q92c", tag: "planning", type: "single", label: "Supplement opinion",
      options: [
        "Not required", "Optional convenience", "Consider due to protein gap",
        "Consider due to training", "Current product appears appropriate",
        "Product or dose review required", "Avoid until clinical clarification",
        "Unsure — AI review required",
      ],
    },
    {
      id: "q93", n: 93, tag: "planning", type: "multi", label: "Carbohydrate strategy",
      options: [
        "Maintain current pattern", "Reduce excessive portions", "Improve quality",
        "Improve distribution", "Increase around training",
        "Increase total carbohydrate availability", "Reduce refined carbohydrate frequency",
        "Training-day adjustment", "Glycaemic consideration", "Unsure — AI review required",
      ],
    },
    {
      id: "q94", n: 94, tag: "planning", type: "multi", label: "Fat strategy",
      options: [
        "Maintain current pattern", "Reduce visible oil or ghee", "Standardise cooking fat",
        "Improve fat quality", "Reduce fried food", "Reduce high-fat outside food",
        "Increase appropriate healthy fats", "Clinical modification required",
        "Unsure — AI review required",
      ],
    },
    {
      id: "q95", n: 95, tag: "planning", type: "multi", label: "Fibre & digestive strategy",
      options: [
        "Maintain current pattern", "Increase vegetables", "Increase fruit", "Increase legumes",
        "Increase whole grains", "Increase food variety", "Gradual fibre increase",
        "Modify trigger foods temporarily", "Digestive symptom strategy required",
        "Clinical gastrointestinal modification required", "Unsure — AI review required",
      ],
    },
    {
      id: "q96", n: 96, tag: "planning", type: "multi", label: "Hydration strategy",
      options: [
        "Maintain current intake", "Increase total fluids", "Improve fluid distribution",
        "Improve workout hydration", "Electrolytes may be relevant", "Reduce sugary beverages",
        "Clinical fluid restriction applies", "Unsure — AI review required",
      ],
    },
    {
      id: "q97", n: 97, tag: "fitness", type: "multi", label: "Workout & recovery strategy",
      options: [
        "No specific modification", "Improve total energy intake", "Improve protein intake",
        "Improve protein distribution", "Improve carbohydrate availability",
        "Improve pre-workout nutrition", "Improve post-workout nutrition", "Improve hydration",
        "Add electrolyte strategy where relevant", "Address sleep-related recovery",
        "Possible under-fuelling correction", "Unsure — AI review required",
      ],
    },
    {
      id: "q98", n: 98, tag: "fitness", type: "multi", label: "Is PT coordination required?",
      options: [
        "Training timing", "Training frequency", "Training intensity", "Training volume or load",
        "Workout energy", "Dizziness or weakness", "Recovery", "Injury or pain",
        "Movement restriction", "Performance decline", "Hydration or sweat",
        "Possible under-fuelling", "No coordination required",
      ],
    },
    {
      id: "q98a", tag: "fitness", type: "single", label: "Coordination priority",
      options: ["Routine", "Important", "Urgent"],
      showIf: (a) => hasOther(a, "q98", ["No coordination required"]),
    },
    {
      id: "q99", n: 99, tag: "planning", type: "multi",
      label: "Nutrition education areas that should be addressed",
      options: [
        "No significant issue", "Carbohydrate fear", "Rice or roti avoidance",
        "Meal-timing misconception", "Fasting misconception", "Fruit or sugar concern",
        "Dietary-fat fear", "Protein safety concern", "Protein-powder concern",
        "Supplement dependency", "Detox belief", "Fasted-training belief",
        "Social-media misinformation", "Other",
      ],
    },
    {
      id: "q99a", tag: "planning", type: "single", label: "Education approach",
      options: [
        "Clarify immediately", "Address gradually", "Retain familiar structure initially",
        "Repeated education required", "Belief contributes to restrictive behaviour",
      ],
      showIf: (a) => hasOther(a, "q99", ["No significant issue"]),
    },
    {
      id: "q100", n: 100, tag: "planning", type: "single",
      label: "Diet structure you believe will fit the client best",
      options: [
        "Fixed structured diet", "Two options per meal", "Multiple meal options",
        "Flexible food exchange", "Portion-based plan", "Habit-first plan",
        "Macro-guided plan", "Hybrid structure", "Unsure — AI should determine",
      ],
    },
    {
      id: "q101", n: 101, tag: "planning", type: "scale10",
      label: "Lifestyle Fit Score — how well does your proposed strategy fit the client's current life? (1–10)",
    },
    {
      id: "q101a", tag: "conditional", type: "single", label: "Main fit concern",
      options: [
        "Too many changes", "Too much cooking", "Meal timing may be unrealistic", "Food cost",
        "Food availability", "Travel", "Restaurant routine",
        "Favourite foods not sufficiently protected", "Family compatibility", "Work routine", "Other",
      ],
      showIf: (a) => scaleAtMost(a, "q101", 7),
    },
    {
      id: "ds2", tag: "clinical", type: "textarea",
      label: "AI hard constraints — non-negotiable rules the AI must follow (one per line)",
      placeholder: "e.g. protein max 60 g/day per nephrologist; no fasting protocols; fluid cap 1.5 L",
      note: "Hard constraints override every other strategy choice except a doctor's instruction.",
    },
    {
      id: "ds3", tag: "planning", type: "textarea",
      label: "Foods the AI must not force — with the nutritional objective needing an alternative",
      placeholder: "e.g. client refuses paneer → protein objective via dal/soy; no raw salad → vegetables cooked",
    },
    {
      id: "ds4", tag: "planning", type: "textarea",
      label: "Special instruction to AI (optional)",
      placeholder: "Anything the AI must know that no structured field captures.",
    },
  ],
};

const S15: Section = {
  id: "discussion",
  code: "15",
  title: "Client strategy discussion",
  stage: "Assessment",
  minutes: "3–4 min",
  intro:
    "Explain only the broad professional hypothesis. Do NOT promise that this is the final AI-generated diet strategy.",
  questions: [
    {
      id: "q102", n: 102, tag: "core", type: "single",
      label: "Does the client understand the main factors currently believed to be affecting progress?",
      options: ["Yes", "Partially", "No"],
    },
    {
      id: "q103", n: 103, tag: "core", type: "single",
      label: "Does the client feel the proposed first-phase direction is realistic?",
      options: ["Yes", "Mostly", "No"],
    },
    {
      id: "q103a", tag: "conditional", type: "single", label: "Main concern",
      options: [
        "Too many changes", "Food options", "Cooking", "Cost", "Work schedule", "Travel",
        "Family compatibility", "Hunger concern", "Craving concern", "Training concern",
        "Favourite foods", "Feels too restrictive", "Does not understand strategy", "Other",
      ],
      showIf: (a) => is(a, "q103", "Mostly") || is(a, "q103", "No"),
    },
    {
      id: "q104", n: 104, tag: "core", type: "multi",
      label: "Was your proposed direction modified after the client discussion?",
      options: [
        "No", "Reduced number of changes", "Changed meal structure", "Added flexibility",
        "Added food options", "Reduced cooking requirement", "Added favourite food",
        "Modified timing", "Added travel consideration", "Added restaurant consideration",
        "Modified initial target", "Modified timeline", "Other",
      ],
    },
    {
      id: "q105", n: 105, tag: "core", type: "scale10",
      label: "Client's final confidence after the counselling discussion (1–10)",
      note: "8–10 high confidence · 6–7 moderate · ≤5 strategy fit requires review.",
    },
  ],
};

export const SECTIONS: Section[] = [
  CLIENT, S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, S14, S15,
];

export const STAGES: Stage[] = [
  "Client", "Goals", "Clinical", "Diet", "Fitness", "Behaviour", "Lifestyle", "Assessment",
];

/** Sections currently visible for these answers. */
export function visibleSections(a: Answers): Section[] {
  return SECTIONS.filter((s) => !s.showIf || s.showIf(a));
}

/** Questions currently visible inside a section. */
export function visibleQuestions(section: Section, a: Answers): Question[] {
  return section.questions.filter((q) => !q.showIf || q.showIf(a));
}

// ---------------------------------------------------------------------------
// MANDATORY QUESTIONS — what a first weekly diet cannot safely be built
// without. A required question only blocks generation while it is visible
// (hidden conditionals don't count). Meal-timeline food fields are marked
// required inline where they are generated.
// ---------------------------------------------------------------------------

const REQUIRED_IDS = new Set<string>([
  // Client details
  "name", "gender", "phone",
  // 1 — Goal & motivation
  "q1", "q2", "q4", "q7", "q8", "gr_dietitian", "gr_client",
  // 2 — Body & transformation history
  "q9_age", "q9_height", "q9_weight", "q10", "q12", "q13", "q14",
  // 3 — Medical & clinical safety
  "q17", "q19", "q19a", "q20", "q21", "q22", "cr1",
  // 4 — Digestion & tolerance
  "q23", "q25", "q27",
  // 5 — Actual food day
  "q28", "q29", "q31", "q32",
  // 6 — Preferences & feasibility
  "q33", "q34", "q35", "q37", "q38", "q39", "q41", "q42",
  // 7 — Training, protein & recovery
  "q43", "q44d", "q44f", "q50", "q50a", "q51", "q52", "q53",
  // 8 — Routine & behaviour
  "q54", "q54c", "q55", "q56", "q58", "q60",
  // 9 — Lifestyle
  "q61", "q61a", "q62", "q63", "q64", "q65", "q67",
  // 10 — Success & coaching
  "q68", "q69", "q70", "q71", "q72", "q73", "q74", "q75",
  // 11 — Dietitian assessment
  "q76", "q77", "q79", "q80", "q81", "q82c", "q83a", "q84", "q87a", "q87b",
  "q89", "q90", "q91", "q92", "q100", "q101",
  // 12 — Client discussion
  "q102", "q103", "q105",
]);

for (const s of SECTIONS)
  for (const q of s.questions) if (REQUIRED_IDS.has(q.id)) q.required = true;

export interface MissingRequired {
  sectionId: string;
  sectionTitle: string;
  questionId: string;
  label: string;
}

/** Required questions still unanswered, respecting section and question visibility. */
export function missingRequired(a: Answers): MissingRequired[] {
  const out: MissingRequired[] = [];
  for (const s of visibleSections(a))
    for (const q of visibleQuestions(s, a))
      if (isRequired(q, a) && !answered(a, q.id))
        out.push({ sectionId: s.id, sectionTitle: s.title, questionId: q.id, label: q.label });
  return out;
}

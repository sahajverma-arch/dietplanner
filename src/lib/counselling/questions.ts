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
  foodsForPattern,
  freqQuestionId,
  portionQuestionId,
} from "../protein-intake";

export type QuestionType =
  | "text"
  | "textarea"
  | "number"
  | "time"
  | "date"
  | "single"
  | "multi"
  | "scale10";

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
  /** Must be answered (when visible) before a diet plan can be generated. */
  required?: boolean;
  showIf?: (a: Answers) => boolean;
}

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

const S1: Section = {
  id: "goal",
  code: "1",
  title: "Goal & deeper motivation",
  stage: "Goals",
  minutes: "6–8 min",
  intro:
    "Ask naturally, let the client speak — select options, don't read them out. The AI plans from the deeper reason, not just the stated goal.",
  questions: [
    {
      id: "q1", n: 1, tag: "core", type: "multi", max: 3,
      label: "What made you decide to work on your health or transformation now?",
      options: [
        "Recent weight gain", "Recent fat gain", "Clothes fitting differently",
        "Unhappy with current body shape", "Low confidence", "Low energy", "Poor fitness",
        "Reduced strength", "Reduced stamina", "Poor workout performance", "Poor recovery",
        "Health report concern", "Doctor recommendation", "Diagnosed health condition",
        "Upcoming wedding", "Upcoming event", "Travel or holiday", "Pregnancy planning",
        "Post-pregnancy transformation", "Sports goal", "Previous failed attempts",
        "Weight regain", "Progress plateau", "Family motivation",
        "Want sustainable lifestyle change", "Frustrated with current routine",
        "Want professional guidance", "Other",
      ],
      probe: "Why now specifically?",
    },
    {
      id: "q2", n: 2, tag: "core", type: "single",
      label: "What is the main result you want to achieve?",
      options: [
        "Fat loss", "Weight loss", "Fat loss with muscle preservation", "Body recomposition",
        "Muscle gain", "Lean mass gain", "Healthy weight gain", "Inch loss",
        "Improve body shape", "Improve muscle definition", "Improve strength",
        "Improve stamina or endurance", "Improve workout performance",
        "Improve sports performance", "Improve energy", "Improve recovery",
        "Improve metabolic health", "Manage a health condition", "Break a progress plateau",
        "Build a sustainable healthy lifestyle", "Not sure — need professional guidance", "Other",
      ],
      why: "Single primary result — drives the whole strategy.",
    },
    {
      id: "q3", n: 3, tag: "core", type: "multi", max: 5,
      label: "What other results are important to you?",
      options: [
        "Reduce weight", "Reduce body fat", "Reduce waist", "Reduce overall inches",
        "Preserve muscle", "Gain muscle", "Improve muscle definition", "Improve body shape",
        "Improve clothing fit", "Improve strength", "Improve stamina",
        "Improve running performance", "Improve sports performance", "Improve workout energy",
        "Improve recovery", "Improve daily energy", "Improve digestion", "Improve blood sugar",
        "Improve cholesterol or triglycerides", "Improve fatty liver markers",
        "Improve hormonal health", "Improve menstrual health",
        "Improve relationship with food", "Improve routine consistency", "Other",
      ],
    },
    {
      id: "q4", n: 4, tag: "core", type: "multi", max: 3,
      label: "Why does achieving this result matter most to you?",
      options: [
        "Improve confidence", "Feel comfortable in clothes", "Improve appearance",
        "Feel physically fitter", "Feel stronger", "Improve sports ability",
        "Improve daily energy", "Improve health markers", "Reduce future health risk",
        "Manage current health condition", "Doctor recommendation", "Improve mobility",
        "Reduce physical discomfort", "Wedding", "Upcoming event", "Travel or holiday",
        "Pregnancy or fertility planning", "Post-pregnancy transformation", "Family motivation",
        "Children or family responsibility", "Frustrated after previous failed attempts",
        "Frustrated with current body", "Frustrated with current health",
        "Want better control over food", "Want a sustainable lifestyle",
        "Improve quality of life", "Other",
      ],
      why: "The deeper motivation personalises coaching communication.",
    },
    {
      id: "q5", n: 5, tag: "core", type: "multi",
      label: "Which specific targets do you currently have in mind?",
      options: [
        "Target weight", "Body-fat target", "Waist target", "Overall inch-loss target",
        "Clothing-size target", "Body-shape target", "Muscle-gain target", "Strength target",
        "Running target", "Stamina target", "Sports-performance target", "Health-marker target",
        "No specific numerical target", "Need Dietitian guidance",
      ],
    },
    {
      id: "q5_weight", tag: "conditional", type: "number", label: "Target weight (kg)",
      showIf: (a) => has(a, "q5", "Target weight"),
    },
    {
      id: "q5_bodyfat", tag: "conditional", type: "number", label: "Body-fat target (%)",
      showIf: (a) => has(a, "q5", "Body-fat target"),
    },
    {
      id: "q5_waist", tag: "conditional", type: "number", label: "Waist target (inches or cm — note unit)",
      showIf: (a) => has(a, "q5", "Waist target"),
    },
    {
      id: "q5_inches", tag: "conditional", type: "number", label: "Overall inch-loss target",
      showIf: (a) => has(a, "q5", "Overall inch-loss target"),
    },
    {
      id: "q5_size", tag: "conditional", type: "text", label: "Clothing-size target",
      placeholder: "e.g. M / 32-inch jeans",
      showIf: (a) => has(a, "q5", "Clothing-size target"),
    },
    {
      id: "q5_other", tag: "conditional", type: "textarea",
      label: "Other targets — muscle / strength / running / stamina / sports / health marker",
      placeholder: "e.g. squat 80 kg; 5k under 30 min; HbA1c below 6",
      showIf: (a) =>
        hasAny(a, "q5", [
          "Muscle-gain target", "Strength target", "Running target", "Stamina target",
          "Sports-performance target", "Health-marker target",
        ]),
    },
    {
      id: "q6", n: 6, tag: "conditional", type: "multi",
      label: "What type of body or physique result are you looking for?",
      options: [
        "Leaner appearance", "Athletic appearance", "Toned appearance",
        "More muscular appearance", "More defined appearance", "Smaller waist",
        "Improved upper-body shape", "Improved lower-body shape",
        "Overall body recomposition", "Not sure", "Other",
      ],
      showIf: (a) =>
        GOAL_TYPES_FOR_PHYSIQUE.includes(val(a, "q2")) || has(a, "q5", "Body-shape target"),
    },
    {
      id: "q7", n: 7, tag: "core", type: "single",
      label: "Do you have a target date or important deadline?",
      options: [
        "No deadline", "Flexible personal target", "Wedding", "Event", "Holiday or travel",
        "Competition", "Sports event", "Medical follow-up", "Birthday",
        "Pregnancy or fertility-related timeline", "Other",
      ],
    },
    {
      id: "q7a", tag: "conditional", type: "date", label: "Target date",
      showIf: (a) => answered(a, "q7") && !is(a, "q7", "No deadline"),
    },
    {
      id: "q7b", tag: "conditional", type: "single", label: "Deadline importance",
      options: ["Flexible", "Important", "Fixed"],
      showIf: (a) => answered(a, "q7") && !is(a, "q7", "No deadline"),
    },
    {
      id: "q8", n: 8, tag: "core", type: "scale10",
      label: "How ready do you currently feel to make realistic changes? (1–10)",
    },
    {
      id: "q8a", tag: "conditional", type: "multi", max: 3,
      label: "What may make change difficult?",
      options: [
        "Work", "Family responsibilities", "Travel", "Stress", "Poor sleep", "Low motivation",
        "Previous failed attempts", "Cravings", "Social eating", "Cooking", "Budget",
        "Health concern", "Fear of restriction", "Consistency concern", "Training routine",
        "Food availability", "Other",
      ],
      showIf: (a) => scaleAtMost(a, "q8", 6),
    },
    {
      id: "gr_dietitian", tag: "core", type: "single",
      label: "Goal reflection — briefly reflect the client's goal, deeper reason and target back to them. Your confirmation:",
      options: [
        "Goal correctly understood", "Client clarified goal", "Client changed primary goal",
        "Client needs professional goal guidance",
      ],
    },
    {
      id: "gr_client", tag: "core", type: "single",
      label: "Client confirmation of the reflection",
      options: ["Correctly understood", "Partially understood", "Needs clarification"],
    },
  ],
};

// ---------------------------------------------------------------------------
// SECTION 2 — BODY AND TRANSFORMATION HISTORY (Q9–Q16)
// ---------------------------------------------------------------------------

const S2: Section = {
  id: "history",
  code: "2",
  title: "Body & transformation history",
  stage: "Goals",
  minutes: "6–8 min",
  questions: [
    { id: "q9_age", n: 9, tag: "core", type: "number", label: "Age (years)" },
    { id: "q9_height", tag: "core", type: "number", label: "Height (cm)" },
    { id: "q9_weight", tag: "core", type: "number", label: "Current weight (kg)" },
    {
      id: "q9_weight_1y", tag: "core", type: "number",
      label: "Weight approximately one year ago (kg)", note: "Leave blank if unknown.",
    },
    {
      id: "q9_weight_high", tag: "core", type: "number",
      label: "Highest adult weight (kg)", note: "Leave blank if unknown.",
    },
    {
      id: "q9_weight_low", tag: "core", type: "number",
      label: "Lowest adult weight (kg)", note: "Leave blank if unknown.",
    },
    {
      id: "q9_weight_comfort", tag: "core", type: "number",
      label: "Previous comfortable weight (kg)", note: "Leave blank if never identified / unknown.",
    },
    {
      id: "q10", n: 10, tag: "core", type: "multi",
      label: "How has your weight or body changed recently?",
      options: [
        "Gradual weight gain", "Rapid weight gain", "Gradual weight loss", "Rapid weight loss",
        "Mostly stable", "Frequent fluctuations", "Stable weight but inches increased",
        "Stable weight but body shape changed", "Possible muscle loss", "Possible fat gain",
        "Not sure",
      ],
    },
    {
      id: "q10a", tag: "conditional", type: "number", label: "Approximate change (kg)",
      showIf: (a) => hasOther(a, "q10", ["Mostly stable", "Not sure"]),
    },
    {
      id: "q10b", tag: "conditional", type: "single", label: "Over what period?",
      options: [
        "Less than 1 month", "1–3 months", "3–6 months", "6–12 months", "1–2 years",
        "More than 2 years", "Not sure",
      ],
      showIf: (a) => hasOther(a, "q10", ["Mostly stable", "Not sure"]),
    },
    {
      id: "q11", n: 11, tag: "core", type: "multi", max: 5,
      label: "What do you think mainly contributed to this change?",
      options: [
        "Job change", "Work schedule", "Sedentary lifestyle", "Reduced exercise",
        "Increased exercise", "Injury", "Illness", "Surgery", "Medication change", "Pregnancy",
        "Postpartum period", "Hormonal change", "Menopause or perimenopause", "Stress",
        "Poor sleep", "Emotional eating", "Frequent outside food", "Alcohol", "Travel",
        "Household or life change", "Irregular meals", "Meal skipping", "Restrictive dieting",
        "Weight regain after dieting", "Low appetite", "Increased appetite",
        "No clear trigger", "Other",
      ],
    },
    {
      id: "q12", n: 12, tag: "core", type: "multi",
      label: "Which diet, weight-management or fitness approaches have you tried before?",
      options: [
        "Calorie counting", "Very-low-calorie diet", "Low-carbohydrate diet", "Keto",
        "Intermittent fasting", "OMAD", "High-protein diet", "Low-fat diet",
        "Detox or juice diet", "Meal replacement", "Commercial weight-loss programme",
        "Dietitian plan", "Social-media diet", "Self-designed diet", "Meal skipping",
        "Sugar elimination", "Rice elimination", "Roti elimination", "Portion control",
        "Gym", "Personal Trainer", "Running or cardio", "Home workout",
        "Exercise-only approach", "Weight-loss medicine", "Supplements or fat burner",
        "Mass gainer", "No structured approach", "Other",
      ],
    },
    {
      id: "q12a", tag: "conditional", type: "single",
      label: "Result of the most important approach tried",
      options: [
        "Good result and maintained", "Good initial result then plateau",
        "Lost weight then regained", "Minimal result", "No result", "Gained weight",
        "Could not follow", "Stopped due to side effects", "Not sure",
      ],
      showIf: (a) => hasOther(a, "q12", ["No structured approach"]),
    },
    {
      id: "q12b", tag: "conditional", type: "multi", max: 3,
      label: "Why did it become difficult?",
      options: [
        "Excessive hunger", "Cravings", "Low energy", "Weakness", "Too restrictive",
        "Food became repetitive", "Social life affected", "Travel", "Work",
        "Cooking difficulty", "Cost", "Family food mismatch", "Poor results", "Slow results",
        "Lost motivation", "No accountability", "Digestive problems",
        "Training performance reduced", "Other",
      ],
      showIf: (a) => hasOther(a, "q12", ["No structured approach"]),
    },
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
    {
      id: "q14", n: 14, tag: "core", type: "multi",
      label: "Have you experienced repeated weight regain or a progress plateau?",
      options: [
        "Repeated weight regain", "Regain after stopping diet", "Regain after stopping exercise",
        "Weight-loss plateau", "Inch-loss plateau", "Strength plateau", "Muscle-gain plateau",
        "Performance plateau", "No", "Not sure",
      ],
    },
    {
      id: "q14a", tag: "conditional", type: "single", label: "Plateau duration",
      options: [
        "Less than 4 weeks", "1–2 months", "2–3 months", "3–6 months",
        "More than 6 months", "Not sure",
      ],
      showIf: (a) =>
        hasAny(a, "q14", [
          "Weight-loss plateau", "Inch-loss plateau", "Strength plateau",
          "Muscle-gain plateau", "Performance plateau",
        ]),
    },
    {
      id: "q15", n: 15, tag: "fitness", type: "multi",
      label: "Which body-composition or measurement data is available?",
      options: [
        "Body-fat percentage", "Muscle mass", "Skeletal muscle mass", "Visceral-fat estimate",
        "Waist", "Hip", "Chest", "Arm", "Thigh", "DEXA", "BIA or smart scale",
        "Gym assessment", "Progress photographs", "No data",
      ],
    },
    {
      id: "q15_bf", tag: "conditional", type: "number", label: "Body-fat (%)",
      showIf: (a) => has(a, "q15", "Body-fat percentage"),
    },
    {
      id: "q15_muscle", tag: "conditional", type: "number", label: "Muscle mass (kg)",
      showIf: (a) => has(a, "q15", "Muscle mass"),
    },
    {
      id: "q15_smm", tag: "conditional", type: "number", label: "Skeletal muscle mass (kg)",
      showIf: (a) => has(a, "q15", "Skeletal muscle mass"),
    },
    {
      id: "q15_visceral", tag: "conditional", type: "number", label: "Visceral-fat estimate",
      showIf: (a) => has(a, "q15", "Visceral-fat estimate"),
    },
    {
      id: "q15_waist", tag: "conditional", type: "number", label: "Waist (inches or cm — note unit)",
      showIf: (a) => has(a, "q15", "Waist"),
    },
    {
      id: "q15_hip", tag: "conditional", type: "number", label: "Hip",
      showIf: (a) => has(a, "q15", "Hip"),
    },
    {
      id: "q15_chest", tag: "conditional", type: "number", label: "Chest",
      showIf: (a) => has(a, "q15", "Chest"),
    },
    {
      id: "q15_arm", tag: "conditional", type: "number", label: "Arm",
      showIf: (a) => has(a, "q15", "Arm"),
    },
    {
      id: "q15_thigh", tag: "conditional", type: "number", label: "Thigh",
      showIf: (a) => has(a, "q15", "Thigh"),
    },
    {
      id: "q15_src", tag: "conditional", type: "single", label: "Measurement source",
      options: ["DEXA", "Clinical BIA", "Smart scale", "Gym machine", "Measuring tape", "Unknown"],
      showIf: (a) => hasOther(a, "q15", ["No data"]),
    },
    {
      id: "q15_assess", tag: "planning", type: "single", label: "Your assessment of this data",
      options: [
        "Reliable baseline", "Use for trend only", "Baseline measurement required",
        "Weight and circumference sufficient initially",
      ],
    },
    {
      id: "q16", n: 16, tag: "core", type: "multi",
      label: "Think about a time when you were healthiest or most consistent. What was different then?",
      options: [
        "Fixed work schedule", "Better sleep", "Lower stress", "Regular meals",
        "Home-cooked food", "Family support", "Partner support", "Friend or workout partner",
        "Regular gym routine", "Regular walking", "Personal Trainer support",
        "Dietitian accountability", "Frequent check-ins", "Meal preparation", "Carried food",
        "Less travel", "Less outside food", "Less alcohol", "More free time",
        "Better motivation", "Food tracking", "Weight tracking", "Specific goal or event",
        "Simple plan", "Strict plan", "More meal options", "Fewer food decisions",
        "Never had a consistent phase", "Cannot identify", "Other",
      ],
      why: "The AI builds the Client Success Pattern from this.",
    },
    {
      id: "q16a", tag: "planning", type: "text",
      label: "Rank the top 3 factors that helped most (in order)",
      placeholder: "e.g. 1) Meal preparation 2) Frequent check-ins 3) Regular gym routine",
      showIf: (a) => hasOther(a, "q16", ["Never had a consistent phase", "Cannot identify"]),
    },
  ],
};

// ---------------------------------------------------------------------------
// SECTION 3 — MEDICAL AND CLINICAL SAFETY (Q17–Q22 + clinical reflection)
// ---------------------------------------------------------------------------

const NO_CONDITION = "No known condition";

const S3: Section = {
  id: "medical",
  code: "3",
  title: "Medical & clinical safety",
  stage: "Clinical",
  minutes: "8–10 min",
  intro: "Blood-report flow: report upload → AI extraction → Dietitian verification (upload where available).",
  questions: [
    {
      id: "q17", n: 17, tag: "clinical", type: "multi",
      label: "Have you been diagnosed with any medical condition?",
      options: [
        NO_CONDITION, "Diabetes", "Prediabetes", "Insulin resistance", "PCOS or PCOD",
        "Hypothyroidism", "Hyperthyroidism", "Other thyroid condition", "High blood pressure",
        "High cholesterol", "High triglycerides", "Fatty liver", "Cardiovascular condition",
        "Kidney condition", "Kidney stones", "Liver condition", "GERD or reflux",
        "Chronic acidity or gastritis", "IBS", "IBD", "Crohn's disease", "Ulcerative colitis",
        "Coeliac disease", "Gallstones", "Gallbladder removed", "Anaemia",
        "Vitamin D deficiency", "Vitamin B12 deficiency", "Iron deficiency",
        "Gout or high uric acid", "Sleep apnoea", "Arthritis",
        "Osteoporosis or bone condition", "Autoimmune condition", "Hormonal condition",
        "Professionally diagnosed eating disorder", "Cancer history", "Other",
      ],
    },
    {
      id: "q17a", tag: "clinical", type: "single", label: "Overall current status of the condition(s)",
      options: ["Controlled", "Improving", "Stable", "Partially controlled", "Uncontrolled", "Under investigation", "Not sure"],
      showIf: (a) => hasOther(a, "q17", [NO_CONDITION]),
    },
    {
      id: "q17b", tag: "clinical", type: "single", label: "Doctor follow-up",
      options: ["Regular", "Occasional", "No", "Not required", "Not sure"],
      showIf: (a) => hasOther(a, "q17", [NO_CONDITION]),
    },
    {
      id: "q17c", tag: "clinical", type: "textarea",
      label: "Per-condition notes (status, since when, treating doctor)",
      placeholder: "e.g. Hypothyroid since 2022 — controlled on 50 mcg; PCOS — under investigation",
      showIf: (a) => hasOther(a, "q17", [NO_CONDITION]),
    },
    {
      id: "q18", n: 18, tag: "clinical", type: "multi",
      label: "Have you had any major surgery, hospitalisation, serious injury or significant medical event?",
      options: [
        "Major surgery", "Hospitalisation", "Fracture", "Sports injury", "Heart-related event",
        "Neurological event", "Severe illness or infection", "Pregnancy-related complication",
        "Gastrointestinal procedure", "Bariatric surgery", "None", "Other",
      ],
    },
    {
      id: "q18a", tag: "conditional", type: "multi", label: "Current impact",
      options: [
        "No current impact", "Affects food intake", "Affects digestion", "Affects mobility",
        "Affects exercise", "Causes pain", "Requires medical monitoring", "Not sure",
      ],
      showIf: (a) => hasOther(a, "q18", ["None"]),
    },
    {
      id: "q19", n: 19, tag: "clinical", type: "single",
      label: "Are you taking any regular medicines?",
      options: ["Yes", "No"],
    },
    {
      id: "q19a", tag: "clinical", type: "textarea",
      label: "Medicines — name, dose, timing (morning/afternoon/evening/night · before/with/after food · weekly)",
      placeholder: "e.g. Thyronorm 50 mcg — morning, empty stomach; Metformin 500 mg — after dinner",
      showIf: (a) => is(a, "q19", "Yes"),
    },
    {
      id: "q19b", tag: "clinical", type: "single", label: "Recent medicine change",
      options: ["No", "Started recently", "Dose increased", "Dose reduced", "Medicine changed", "Not sure"],
      showIf: (a) => is(a, "q19", "Yes"),
    },
    {
      id: "q20", n: 20, tag: "clinical", type: "multi",
      label: "Which recent blood reports are available?",
      options: [
        "CBC or haemoglobin", "Fasting glucose", "HbA1c", "Fasting insulin", "Lipid profile",
        "Thyroid profile", "Liver function", "Kidney function", "Vitamin D", "Vitamin B12",
        "Iron or ferritin", "Uric acid", "Hormonal or reproductive reports", "Other",
        "Reports available but client is unsure", "Can arrange reports", "No recent reports",
      ],
    },
    {
      id: "q20a", tag: "clinical", type: "single", label: "Known status of the reports",
      options: ["All reported normal", "One or more abnormal", "Client unsure", "Reports require review"],
      showIf: (a) => hasOther(a, "q20", ["No recent reports"]),
    },
    {
      id: "q20b", tag: "clinical", type: "textarea",
      label: "Abnormal values / report notes",
      placeholder: "e.g. HbA1c 6.1, Vitamin D 14 ng/mL, TSH 8.2",
      showIf: (a) => is(a, "q20a", "One or more abnormal") || is(a, "q20a", "Reports require review"),
    },
    {
      id: "q21", n: 21, tag: "clinical", type: "multi",
      label: "Have you recently experienced any of these symptoms?",
      options: [
        "Chest pain or pressure", "Fainting", "Severe breathlessness",
        "Breathlessness during light activity", "Irregular or very rapid heartbeat sensation",
        "Severe dizziness", "Sudden unexplained weakness", "Unusual fatigue during normal activity",
        "Severe exercise-related headache", "New ankle or leg swelling", "Repeated vomiting",
        "Blood in stool", "Black or tarry stool", "Unexplained rapid weight loss", "None", "Other",
      ],
      note: "Any selection other than None triggers the safety follow-ups and may require escalation.",
    },
    {
      id: "q21a", tag: "clinical", type: "single", label: "Frequency",
      options: ["Once", "Rarely", "Sometimes", "Frequently", "Almost daily"],
      showIf: (a) => hasOther(a, "q21", ["None"]),
    },
    {
      id: "q21b", tag: "clinical", type: "single", label: "Has a doctor assessed this?",
      options: ["Yes", "No", "Appointment planned"],
      showIf: (a) => hasOther(a, "q21", ["None"]),
    },
    {
      id: "q21c", tag: "clinical", type: "single", label: "Safety status (your call)",
      options: [
        "No immediate concern identified", "Clinical Dietitian review required",
        "Doctor review or clearance should be considered", "Urgent SOP escalation",
      ],
      showIf: (a) => hasOther(a, "q21", ["None"]),
    },
    {
      id: "q22", n: 22, tag: "clinical", type: "multi",
      label: "Has a healthcare professional given any specific food, nutrition, fluid, supplement or exercise instruction?",
      options: [
        "No instruction", "Sodium restriction", "Fluid restriction", "Potassium restriction",
        "Protein restriction", "Purine restriction", "Gluten avoidance",
        "Lactose or dairy restriction", "Blood-sugar advice", "Cholesterol or fat advice",
        "Food-medication timing", "Avoid specific supplement", "Exercise-intensity restriction",
        "Avoid specific movement", "Other",
      ],
      note: "A doctor's instruction overrides plan design.",
    },
    {
      id: "q22a", tag: "clinical", type: "textarea", label: "Instruction details",
      placeholder: "e.g. fluid restricted to 1.5 L/day; no high-intensity cardio",
      showIf: (a) => hasOther(a, "q22", ["No instruction"]),
    },
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
// SECTION 4 — DIGESTION, BOWEL PATTERN AND FOOD TOLERANCE (Q23–Q27)
// ---------------------------------------------------------------------------

const S4: Section = {
  id: "digestion",
  code: "4",
  title: "Digestion, bowel & food tolerance",
  stage: "Clinical",
  minutes: "4–5 min",
  questions: [
    {
      id: "q23", n: 23, tag: "core", type: "single",
      label: "How would you describe your digestion overall?",
      options: [
        "Very comfortable", "Mostly comfortable", "Occasionally uncomfortable",
        "Frequently uncomfortable", "Significantly affects food or routine", "Not sure",
      ],
    },
    {
      id: "q24", n: 24, tag: "clinical", type: "multi",
      label: "Which digestive symptoms do you experience?",
      options: [
        "Bloating", "Gas", "Acidity or heartburn", "Reflux", "Constipation", "Loose stools",
        "Alternating constipation and loose stools", "Abdominal discomfort or pain", "Nausea",
        "Vomiting", "Early fullness", "Excessive burping", "Difficulty swallowing", "None", "Other",
      ],
    },
    {
      id: "q24a", tag: "conditional", type: "single", label: "Frequency of the main symptom",
      options: ["Rare", "1–2 times per week", "3–5 times per week", "Daily", "Multiple times daily"],
      showIf: (a) => hasOther(a, "q24", ["None"]),
    },
    {
      id: "q24b", tag: "conditional", type: "multi", label: "Usual timing",
      options: [
        "Morning", "After breakfast", "After lunch", "Evening", "After dinner", "Night",
        "After specific foods", "During stress", "Around training", "Random",
      ],
      showIf: (a) => hasOther(a, "q24", ["None"]),
    },
    {
      id: "q24c", tag: "conditional", type: "scale10", label: "Severity (1–10)",
      showIf: (a) => hasOther(a, "q24", ["None"]),
    },
    {
      id: "q25", n: 25, tag: "core", type: "single",
      label: "What is your usual bowel frequency?",
      options: [
        "More than 3 times daily", "2–3 times daily", "Once daily", "Once every 2 days",
        "Less than 3 times weekly", "Highly irregular", "Prefer not to answer",
      ],
    },
    {
      id: "q25a", tag: "clinical", type: "multi", label: "Stool experience",
      options: [
        "Comfortable and formed", "Hard or dry", "Straining", "Loose or watery", "Urgent",
        "Incomplete emptying", "Mucus", "Blood", "Black or tarry", "Significant pain",
        "Highly variable",
      ],
    },
    {
      id: "q26", n: 26, tag: "clinical", type: "multi",
      label: "Are there foods that repeatedly cause discomfort?",
      options: [
        "Milk", "Curd", "Paneer", "Wheat or gluten foods", "Fried food", "High-fat food",
        "Spicy food", "Onion", "Garlic", "Dal", "Chickpeas", "Rajma or beans", "Soy", "Eggs",
        "Seafood", "Nuts", "Artificial sweeteners", "Protein powder",
        "No repeated discomfort", "Other",
      ],
    },
    {
      id: "q26a", tag: "conditional", type: "multi", label: "Reaction",
      options: [
        "Bloating", "Gas", "Acidity", "Reflux", "Pain", "Nausea", "Loose stools",
        "Constipation", "Skin reaction", "Other",
      ],
      showIf: (a) => hasOther(a, "q26", ["No repeated discomfort"]),
    },
    {
      id: "q26b", tag: "conditional", type: "single", label: "Pattern",
      options: ["Almost every time", "Often", "Sometimes", "Client is unsure"],
      showIf: (a) => hasOther(a, "q26", ["No repeated discomfort"]),
    },
    {
      id: "q26c", tag: "conditional", type: "text", label: "Other trigger foods",
      showIf: (a) => has(a, "q26", "Other"),
    },
    {
      id: "q27", n: 27, tag: "clinical", type: "multi",
      label: "Do you have any known food allergy?",
      options: [
        "No known allergy", "Milk", "Egg", "Peanut", "Tree nuts", "Wheat", "Soy", "Fish",
        "Shellfish", "Sesame", "Other",
      ],
      note: "An allergen must never appear in any meal, in any form or preparation.",
    },
    {
      id: "q27a", tag: "clinical", type: "single", label: "Reaction severity",
      options: ["Mild", "Moderate", "Severe", "Previous emergency reaction", "Unknown"],
      showIf: (a) => hasOther(a, "q27", ["No known allergy"]),
    },
    {
      id: "q27b", tag: "clinical", type: "single", label: "Professionally diagnosed?",
      options: ["Yes", "No", "Not sure"],
      showIf: (a) => hasOther(a, "q27", ["No known allergy"]),
    },
    {
      id: "q27c", tag: "conditional", type: "text", label: "Other allergen",
      showIf: (a) => has(a, "q27", "Other"),
    },
  ],
};

// ---------------------------------------------------------------------------
// SECTION 5 — ACTUAL FOOD AND DRINK PATTERN (Q28–Q32) — interactive meal
// timeline: per selected occasion, time/food/preparation/source/components.
// ---------------------------------------------------------------------------

export const MEAL_OCCASIONS: { key: string; label: string }[] = [
  { key: "wake", label: "Wake-up intake" },
  { key: "breakfast", label: "Breakfast" },
  { key: "midmorning", label: "Mid-morning" },
  { key: "lunch", label: "Lunch" },
  { key: "afternoon", label: "Afternoon" },
  { key: "evening", label: "Evening snack" },
  { key: "preworkout", label: "Pre-workout" },
  { key: "duringworkout", label: "During workout" },
  { key: "postworkout", label: "Post-workout" },
  { key: "dinner", label: "Dinner" },
  { key: "afterdinner", label: "After dinner" },
  { key: "beforesleep", label: "Before sleep" },
  { key: "other", label: "Other" },
];

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
        id: `q28_${key}_time`, tag: "conditional", type: "time",
        label: `${label} — usual time`, showIf: show,
      },
      {
        id: `q28_${key}_food`, tag: "conditional", type: "textarea", required: true,
        label: `${label} — food/drink with quantity`,
        placeholder: "e.g. 2 rotis + dal 1 katori + salad · tea with 1 tsp sugar",
        showIf: show,
      },
      {
        id: `q28_${key}_prep`, tag: "conditional", type: "multi",
        label: `${label} — preparation`, options: PREPARATION, showIf: show,
      },
      {
        id: `q28_${key}_source`, tag: "conditional", type: "single",
        label: `${label} — source`, options: FOOD_SOURCE, showIf: show,
      },
      {
        id: `q28_${key}_extras`, tag: "conditional", type: "multi",
        label: `${label} — added components`, options: EXTRA_COMPONENTS, showIf: show,
      }
    );
  }
  return out;
}

const S5: Section = {
  id: "foodday",
  code: "5",
  title: "Actual food & drink pattern",
  stage: "Diet",
  minutes: "10–12 min",
  intro:
    "“Take me through what you actually eat and drink on a normal day.” Select every meal occasion the client has, then fill the timeline for each.",
  questions: [
    {
      id: "q28", n: 28, tag: "core", type: "multi",
      label: "Meal occasions on a normal day",
      options: MEAL_OCCASIONS.map((o) => o.label),
    },
    ...mealTimelineQuestions(),
    {
      id: "q29", n: 29, tag: "core", type: "single",
      label: "How typical is this food day?",
      options: [
        "Very typical", "Mostly typical", "Weekdays are similar", "Weekends are different",
        "Changes daily", "Workday and off-day are different", "Travel changes the routine",
        "Shift changes the routine", "Today was unusual",
      ],
    },
    {
      id: "q30", n: 30, tag: "core", type: "multi",
      label: "What usually changes on weekends or days off?",
      options: [
        "No major change", "Wake later", "Skip breakfast", "Delayed meals", "Fewer meals",
        "Larger meals", "Restaurant food", "Delivery food", "More snacks", "More sweets",
        "More alcohol", "Family meals", "Social events", "Less protein", "Less water",
        "Late-night eating", "No fixed pattern", "Other",
      ],
    },
    {
      id: "q31", n: 31, tag: "core", type: "single",
      label: "How often do you eat food prepared outside your home?",
      options: [
        "More than once daily", "Daily", "4–6 times weekly", "2–3 times weekly",
        "Once weekly", "1–3 times monthly", "Rarely",
      ],
    },
    {
      id: "q31a", tag: "conditional", type: "multi", label: "Main sources",
      options: [
        "Restaurant", "Delivery", "Office or canteen", "College", "Hotel",
        "Business or client meals", "Family meals", "Street food", "Travel food",
      ],
      showIf: (a) => answered(a, "q31") && !is(a, "q31", "Rarely"),
    },
    {
      id: "q31b", tag: "conditional", type: "textarea", label: "Common orders",
      placeholder: "e.g. butter chicken + naan; masala dosa; biryani",
      showIf: (a) => answered(a, "q31") && !is(a, "q31", "Rarely"),
    },
    {
      id: "q32", n: 32, tag: "core", type: "multi",
      label: "Which smaller foods or drinks are also part of your routine?",
      options: [
        "Tea", "Coffee", "Added sugar", "Milk beverages", "Juice", "Soft drinks",
        "Diet soft drinks", "Energy drinks", "Biscuits", "Namkeen", "Chips", "Nuts or seeds",
        "Sweets or mithai", "Chocolate", "Desserts", "Sauces", "Dressings", "Pickle", "Chutney",
        "Office snacks", "Food from colleagues or friends", "Tasting while cooking",
        "Children's leftovers", "Late-night bites", "Nothing significant", "Other",
      ],
      why: "Hidden intake — often the real calorie gap.",
    },
    {
      id: "q32a", tag: "conditional", type: "textarea",
      label: "Frequency & quantity of the selected items",
      placeholder: "e.g. tea ×3/day with 1 tsp sugar each; biscuits 4–5 with evening tea",
      showIf: (a) => hasOther(a, "q32", ["Nothing significant"]),
    },
  ],
};

// ---------------------------------------------------------------------------
// SECTION 6 — FOOD PREFERENCES AND REAL-LIFE FEASIBILITY (Q33–Q42)
// ---------------------------------------------------------------------------

const S6: Section = {
  id: "preferences",
  code: "6",
  title: "Food preferences & real-life feasibility",
  stage: "Diet",
  minutes: "6–8 min",
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
      id: "q34", n: 34, tag: "core", type: "multi", max: 3,
      label: "Which cuisines best represent your normal household food?",
      options: [
        "North Indian", "Punjabi", "Gujarati", "Rajasthani", "Maharashtrian", "Bengali",
        "Bihari or Jharkhand", "South Indian", "Kerala-style", "Tamil", "Telugu", "Karnataka",
        "North-East Indian", "Kashmiri", "Indian mixed", "Middle Eastern", "Mediterranean",
        "East Asian", "South-East Asian", "European or Western", "African", "Latin American",
        "Mixed or international", "Other",
      ],
    },
    {
      id: "q34a", tag: "core", type: "text", label: "Country of residence",
      placeholder: "e.g. India",
    },
    {
      id: "q34b", tag: "core", type: "text", label: "City",
      placeholder: "e.g. Chandigarh",
    },
    {
      id: "q34c", tag: "planning", type: "multi",
      label: "Which staple foods are normally part of your routine?",
      options: [
        "Roti", "Rice", "Paratha", "Bread", "Oats", "Poha", "Upma", "Idli", "Dosa",
        "Millet", "Pasta", "Noodles", "Potato", "Other",
      ],
      why: "Staples anchor the plan — improved, not replaced.",
    },
    {
      id: "q35", n: 35, tag: "planning", type: "textarea",
      label: "Which foods or meals do you genuinely enjoy? (up to 10, favourites first)",
      placeholder: "e.g. rajma chawal, paneer bhurji, masala dosa, fruit chaat …",
      why: "Favourites are protected in the plan where clinically appropriate.",
    },
    {
      id: "q36", n: 36, tag: "planning", type: "textarea",
      label: "Which foods do you dislike or strongly prefer not to eat?",
      placeholder: "e.g. lauki, karela, tinda",
    },
    {
      id: "q36a", tag: "conditional", type: "single", label: "Preference strength",
      options: ["Mild dislike", "Strong dislike", "Will not eat"],
      showIf: (a) => answered(a, "q36"),
    },
    {
      id: "q37", n: 37, tag: "planning", type: "multi",
      label: "Which foods or food habits do you strongly want to keep?",
      options: [
        "Tea", "Coffee", "Rice", "Roti", "Bread", "Milk", "Sweets or dessert", "Chocolate",
        "Weekend restaurant meal", "Social meal", "Traditional household food",
        "Current breakfast", "Evening snack", "Late dinner due to routine",
        "No strong non-negotiable", "Other",
      ],
      why: "Non-negotiables stay in the plan — the meal is improved, not deleted.",
    },
    {
      id: "q38", n: 38, tag: "clinical", type: "multi",
      label: "Are there cultural, religious, ethical or household food restrictions?",
      options: [
        "No restriction", "Vegetarian household", "Vegan preference", "Jain restrictions",
        "Halal", "Kosher", "No beef", "No pork", "No egg",
        "No non-vegetarian food on selected days", "Fasting practice",
        "Separate cooking not allowed", "Ethical or environmental restriction",
        "Prefer not to answer", "Other",
      ],
    },
    {
      id: "q38a", tag: "conditional", type: "multi", label: "On which days?",
      options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      showIf: (a) =>
        has(a, "q38", "No non-vegetarian food on selected days") || has(a, "q38", "Fasting practice"),
    },
    {
      id: "q38b", tag: "conditional", type: "multi", label: "What is avoided on those days?",
      options: [
        "Non-vegetarian food", "Eggs", "Onion & garlic", "All animal products",
        "Specific grains (fasting)", "Other",
      ],
      showIf: (a) =>
        has(a, "q38", "No non-vegetarian food on selected days") || has(a, "q38", "Fasting practice"),
    },
    {
      id: "q38c", tag: "conditional", type: "text", label: "Day-rule details",
      placeholder: "e.g. Tuesdays & Thursdays — no non-veg or eggs; Navratri fasts",
      showIf: (a) =>
        has(a, "q38", "No non-vegetarian food on selected days") || has(a, "q38", "Fasting practice"),
    },
    {
      id: "q39", n: 39, tag: "core", type: "multi",
      label: "Who normally prepares your food?",
      options: [
        "Self", "Spouse or partner", "Parent or family", "Cook or helper", "PG or hostel kitchen",
        "Office or canteen", "Tiffin service", "Restaurant or delivery", "Varies",
      ],
    },
    {
      id: "q39a", tag: "planning", type: "single", label: "Food preparation control",
      options: ["Full", "Good", "Some", "Very little", "None"],
    },
    {
      id: "q40", n: 40, tag: "core", type: "multi",
      label: "Which cooking or food-storage facilities are available?",
      options: [
        "Full kitchen", "Gas or induction", "Refrigerator", "Freezer", "Microwave",
        "Blender or mixer", "Air fryer", "Oven", "Electric kettle",
        "Food-storage or lunch boxes", "Food weighing scale", "Limited kitchen",
        "No cooking facility",
      ],
    },
    {
      id: "q41", n: 41, tag: "planning", type: "multi",
      label: "What meal preparation is realistically possible?",
      options: [
        "Cook daily", "Simple cooking only", "Prepare food in advance",
        "Batch cook 1–2 times weekly", "Household cook can make changes", "Carry meals",
        "Carry snacks only", "Work refrigerator available", "Work microwave available",
        "Cannot carry food", "Very little preparation time", "Not willing to add cooking",
        "Maximum 5 minutes additional preparation", "10–15 minutes additional preparation",
        "20–30 minutes additional preparation",
        "Limited additional cooking acceptable", "Significant meal preparation acceptable",
      ],
    },
    {
      id: "q42", n: 42, tag: "planning", type: "single",
      label: "Food budget",
      options: [
        "Very budget-conscious", "Moderate household-food budget", "Flexible",
        "Premium options acceptable", "No concern", "Prefer not to answer",
      ],
    },
    {
      id: "q42a", tag: "planning", type: "multi", label: "Limited access to",
      options: [
        "High-protein dairy", "Paneer", "Tofu or tempeh", "Soy", "Eggs", "Chicken",
        "Fish or seafood", "Meat", "Protein powder", "Nuts or seeds", "Imported foods",
        "Specific fruits", "Specific vegetables", "Specialty health foods",
        "No major limitation", "Other",
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// SECTION 7 — TRAINING, PROTEIN AND RECOVERY (Q43–Q53)
// ---------------------------------------------------------------------------

const isTraining = (a: Answers) => hasOther(a, "q43", ["Currently not exercising"]);

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
        note: `Standard portion: ${food.portion} (${food.proteinPerPortion} g protein). Leave blank if standard.`,
        options: PORTION_OPTIONS.map((p) => p.label),
        showIf: show,
      }
    );
  }
  return out;
}

const S7: Section = {
  id: "training",
  code: "7",
  title: "Training, protein & recovery",
  stage: "Fitness",
  minutes: "8–10 min",
  questions: [
    {
      id: "q43", n: 43, tag: "fitness", type: "multi",
      label: "What exercise or training are you currently doing?",
      options: [
        "Starting with LeanR PT", "Strength training", "Cardio machines", "Running", "Walking",
        "Yoga", "Pilates", "Swimming", "Cycling", "Sports", "Home workout", "HIIT",
        "Group classes", "Rehabilitation exercise", "Currently not exercising", "Other",
      ],
    },
    {
      id: "q44a", n: 44, tag: "fitness", type: "single", label: "Training days per week",
      options: ["0", "1", "2", "3", "4", "5", "6", "7", "Variable"],
      showIf: isTraining,
    },
    {
      id: "q44b", tag: "fitness", type: "single", label: "Session duration",
      options: [
        "Less than 30 minutes", "30–45 minutes", "45–60 minutes", "60–90 minutes",
        "More than 90 minutes", "Variable",
      ],
      showIf: isTraining,
    },
    {
      id: "q44c", tag: "fitness", type: "single", label: "Training time",
      options: ["Early morning", "Morning", "Afternoon", "Evening", "Night", "Variable"],
      showIf: isTraining,
    },
    {
      id: "q44g", tag: "fitness", type: "single", label: "Training location",
      options: ["Gym", "Home", "Outdoor", "Mixed"],
      showIf: isTraining,
    },
    {
      id: "q44d", tag: "fitness", type: "single", label: "Training experience",
      options: [
        "Complete beginner", "Less than 6 months", "6–12 months", "1–3 years",
        "More than 3 years", "Returning after a break",
      ],
    },
    {
      id: "q44e", tag: "fitness", type: "single", label: "Intensity",
      options: ["Very light", "Light", "Moderate", "Hard", "Very hard", "Variable", "Not sure"],
      showIf: isTraining,
    },
    {
      id: "q44f", tag: "fitness", type: "single", label: "Primary training goal",
      options: [
        "General fitness", "Fat loss", "Muscle gain", "Strength", "Endurance",
        "Running performance", "Sports performance", "Mobility or rehabilitation", "Mixed",
      ],
    },
    {
      id: "q45", n: 45, tag: "fitness", type: "multi",
      label: "How do you normally feel during training?",
      options: [
        "Good energy", "Low energy before starting", "Energy drops early", "Energy drops midway",
        "Excessive hunger", "Weakness", "Dizziness", "Nausea", "Cramps",
        "Unusual breathlessness", "Headache", "Shakiness", "Too full or heavy",
        "No major problem", "Other",
      ],
      showIf: isTraining,
    },
    {
      id: "q46", n: 46, tag: "fitness", type: "multi",
      label: "How do you normally feel after training and between sessions?",
      options: [
        "Recover well", "Mild normal soreness", "Excessive soreness", "Soreness for several days",
        "Persistent fatigue", "Strength declining", "Performance declining", "Poor sleep",
        "Excessive hunger", "Low appetite", "Frequent cramps", "Feel dehydrated", "Other",
      ],
      showIf: isTraining,
    },
    {
      id: "q47", n: 47, tag: "fitness", type: "multi",
      label: "What do you normally have before training?",
      options: [
        "Full meal", "Small meal", "Snack", "Fruit or carbohydrate source", "Protein food",
        "Protein shake", "Pre-workout supplement", "Caffeine", "Water only", "Train fasted",
        "Variable",
      ],
      showIf: isTraining,
    },
    {
      id: "q47a", tag: "fitness", type: "single", label: "How long before training?",
      options: [
        "Less than 30 minutes before", "30–60 minutes before", "1–2 hours before",
        "2–3 hours before", "More than 3 hours before",
      ],
      showIf: (a) => isTraining(a) && hasOther(a, "q47", ["Train fasted", "Water only"]),
    },
    {
      id: "q48", n: 48, tag: "fitness", type: "multi",
      label: "What do you normally consume during training?",
      options: [
        "Nothing", "Water", "Electrolytes", "Sports drink", "Carbohydrate drink or gel",
        "BCAA or EAA", "Other supplement", "Food",
      ],
      showIf: isTraining,
    },
    {
      id: "q49", n: 49, tag: "fitness", type: "multi",
      label: "What do you normally have after training?",
      options: [
        "Full meal", "Small meal", "Protein-rich food", "Protein shake",
        "Fruit or carbohydrate source", "Milk or dairy beverage", "Water only",
        "Nothing for several hours", "Variable",
      ],
      showIf: isTraining,
    },
    {
      id: "q49a", tag: "fitness", type: "single", label: "How soon after training?",
      options: ["Less than 30 minutes", "30–60 minutes", "1–2 hours", "2–3 hours", "More than 3 hours"],
      showIf: (a) => isTraining(a) && hasOther(a, "q49", ["Nothing for several hours"]),
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
        "Answer Q33 “What food pattern do you follow?” (Section 6) first — the protein list is built from it.",
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
    {
      id: "q51", n: 51, tag: "clinical", type: "multi",
      label: "Which supplements are you currently using?",
      options: [
        "Protein powder", "Creatine", "Pre-workout", "BCAA or EAA", "Electrolytes",
        "Mass gainer", "Fat burner", "Multivitamin", "Vitamin D", "Vitamin B12", "Iron",
        "Calcium", "Omega-3", "Magnesium", "Herbal or Ayurvedic product", "None", "Other",
      ],
    },
    {
      id: "q51a", tag: "conditional", type: "single", label: "Mainly recommended by",
      options: ["Doctor", "Dietitian", "Personal Trainer", "Friend or family", "Social media", "Self", "Other"],
      showIf: (a) => hasOther(a, "q51", ["None"]),
    },
    {
      id: "q51b", tag: "conditional", type: "multi", label: "Any side effects?",
      options: ["None", "Digestive issue", "Headache", "Sleep issue", "Palpitations", "Skin issue", "Other"],
      showIf: (a) => hasOther(a, "q51", ["None"]),
    },
    {
      id: "q51c", tag: "conditional", type: "textarea", label: "Supplement details (product, dose, frequency)",
      placeholder: "e.g. whey 1 scoop post-workout daily; Vitamin D 60k IU weekly",
      showIf: (a) => hasOther(a, "q51", ["None"]),
    },
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
    {
      id: "q53", n: 53, tag: "fitness", type: "multi",
      label: "Do you have any current pain, injury or movement limitation?",
      options: [
        "Knee", "Lower back", "Upper back", "Neck", "Shoulder", "Elbow or wrist", "Hip",
        "Ankle or foot", "Previous fracture", "Post-surgery limitation",
        "Medically restricted movement", "No limitation", "Other",
      ],
    },
    {
      id: "q53a", tag: "conditional", type: "single", label: "Assessed by",
      options: ["Doctor", "Physiotherapist", "Personal Trainer", "Self-observed", "Not assessed"],
      showIf: (a) => hasOther(a, "q53", ["No limitation"]),
    },
    {
      id: "q53b", tag: "fitness", type: "single", label: "PT handover",
      options: ["Required", "Not required", "Dietitian unsure"],
    },
  ],
};

// ---------------------------------------------------------------------------
// SECTION 8 — ROUTINE, HUNGER AND EATING BEHAVIOUR (Q54–Q60)
// ---------------------------------------------------------------------------

const S8: Section = {
  id: "routine",
  code: "8",
  title: "Routine, hunger & eating behaviour",
  stage: "Behaviour",
  minutes: "6–8 min",
  questions: [
    {
      id: "q54", n: 54, tag: "core", type: "single", label: "Work type",
      options: [
        "Desk-based", "Standing", "Physical work", "Field work", "Work from home", "Hybrid",
        "Student", "Homemaker", "Not working", "Other",
      ],
    },
    {
      id: "q54a", tag: "core", type: "single", label: "Shift",
      options: ["Day", "Evening", "Night", "Rotational", "Split", "Flexible", "Not applicable"],
    },
    {
      id: "q54b", tag: "core", type: "single", label: "Meal breaks",
      options: ["Fixed", "Flexible", "Short only", "Frequently missed", "No reliable break"],
    },
    {
      id: "q54c", tag: "core", type: "single", label: "Daily activity outside exercise",
      options: ["Mostly seated", "Lightly active", "Moderately active", "Active", "Highly physical"],
    },
    {
      id: "q54d", tag: "core", type: "number", label: "Average daily steps",
      note: "Leave blank if unknown.",
    },
    {
      id: "q54e", tag: "core", type: "single", label: "Commute",
      options: ["No commute", "Less than 30 minutes", "30–60 minutes", "1–2 hours", "More than 2 hours"],
    },
    {
      id: "q55", n: 55, tag: "core", type: "multi", max: 3,
      label: "Which times or situations are hardest for you to manage food?",
      options: [
        "Early morning", "Breakfast", "Mid-morning", "Lunch", "Afternoon", "Evening",
        "Pre-workout", "Post-workout", "Dinner", "Late night", "Weekend", "Travel",
        "Social events", "No specific time",
      ],
    },
    {
      id: "q55a", tag: "conditional", type: "multi", label: "Main reasons",
      options: [
        "No time", "No appetite", "Excessive hunger", "Meetings", "No meal break",
        "Food unavailable", "Cannot carry food", "Family routine", "Cravings", "Stress",
        "Commute", "Training timing", "Tiredness", "Cooking difficulty", "Other",
      ],
      showIf: (a) => hasOther(a, "q55", ["No specific time"]),
    },
    {
      id: "q56", n: 56, tag: "core", type: "single",
      label: "How does your hunger usually behave?",
      options: [
        "Stable", "Low hunger most of the day", "High morning hunger", "High lunch hunger",
        "High evening hunger", "High night hunger", "Extreme post-workout hunger",
        "Unpredictable", "Often eat without physical hunger", "Not sure",
      ],
    },
    {
      id: "q57", n: 57, tag: "core", type: "multi",
      label: "How would you describe your appetite?",
      options: [
        "Good", "Very strong", "Low", "Variable", "Become full quickly",
        "Struggle to finish meals", "Forget to eat", "Delay eating despite hunger",
        "Hungry but not interested in food", "Reduced after training", "Increased after training",
        "Reduced by stress", "Increased by stress", "No concern",
      ],
    },
    {
      id: "q58", n: 58, tag: "core", type: "multi",
      label: "Which strong cravings do you experience?",
      options: [
        "Sweets or mithai", "Chocolate", "Bakery foods", "Fried foods", "Salty snacks",
        "Chips or namkeen", "Fast food", "Carbohydrate-rich foods", "Sugary drinks",
        "Tea or coffee", "Late-night food", "No strong cravings", "Other",
      ],
    },
    {
      id: "q58a", tag: "conditional", type: "multi", max: 3, label: "Main triggers",
      options: [
        "Hunger", "Stress", "Boredom", "Poor sleep", "Menstrual cycle", "Previous restriction",
        "Social situation", "Food cues", "Work pressure", "Habit", "Post-workout", "Other",
      ],
      showIf: (a) => hasOther(a, "q58", ["No strong cravings"]),
    },
    {
      id: "q58b", tag: "conditional", type: "single", label: "Common craving time",
      options: ["Morning", "Afternoon", "Evening", "Late night", "Post-workout", "Variable"],
      showIf: (a) => hasOther(a, "q58", ["No strong cravings"]),
    },
    {
      id: "q59", n: 59, tag: "core", type: "multi",
      label: "How does stress or mental exhaustion affect your eating?",
      options: [
        "Eat more", "Eat less", "Skip meals", "Crave specific foods", "Continuous snacking",
        "Order food more often", "Eating becomes irregular", "No major effect", "Variable",
      ],
    },
    {
      id: "q60", n: 60, tag: "clinical", type: "multi",
      label: "Have you experienced any of these eating patterns?",
      options: [
        "Feeling unable to control eating", "Eating an unusually large amount with distress",
        "Severe or prolonged food restriction", "Skipping meals to compensate",
        "Significant guilt after eating", "Anxiety after eating", "Strong fear of specific foods",
        "Self-induced vomiting", "Other compensatory behaviour",
        "Professionally diagnosed eating disorder", "Currently receiving professional support",
        "None", "Prefer not to answer",
      ],
      note: "Handle sensitively. Do not intensify restriction where risk is present.",
    },
    {
      id: "q60a", tag: "clinical", type: "single", label: "Your safety selection",
      options: [
        "No concern identified", "Explore sensitively", "Senior clinical review required",
        "Professional referral should be considered", "Avoid intensified restriction until reviewed",
      ],
      showIf: (a) => hasOther(a, "q60", ["None"]),
    },
  ],
};

// ---------------------------------------------------------------------------
// SECTION 9 — SLEEP, STRESS, HYDRATION AND LIFESTYLE (Q61–Q67)
// ---------------------------------------------------------------------------

const S9: Section = {
  id: "lifestyle",
  code: "9",
  title: "Sleep, stress, hydration & lifestyle",
  stage: "Lifestyle",
  minutes: "5–6 min",
  questions: [
    {
      id: "q61", n: 61, tag: "core", type: "single", label: "Sleep duration",
      options: [
        "Less than 5 hours", "5–6 hours", "6–7 hours", "7–8 hours", "8–9 hours",
        "More than 9 hours", "Variable",
      ],
    },
    { id: "q61a", tag: "core", type: "scale10", label: "Sleep quality (1–10)" },
    {
      id: "q61b", tag: "core", type: "single", label: "Wake refreshed?",
      options: ["Yes", "Sometimes", "No"],
    },
    {
      id: "q61c", tag: "clinical", type: "multi", label: "Sleep concerns",
      options: [
        "Difficulty falling asleep", "Frequent waking", "Wake too early", "Heavy snoring",
        "Observed breathing pauses", "Daytime sleepiness", "Shift-related sleep issue",
        "Late caffeine", "Training affects sleep", "No major concern", "Other",
      ],
    },
    { id: "q62", n: 62, tag: "core", type: "scale10", label: "Current stress level (1–10)" },
    {
      id: "q62a", tag: "conditional", type: "multi", max: 3, label: "Main stress sources",
      options: [
        "Work", "Business", "Studies", "Financial", "Family", "Relationship", "Health",
        "Body or weight", "Caregiving", "Travel", "Poor sleep", "Other",
      ],
      showIf: (a) => answered(a, "q62"),
    },
    {
      id: "q62b", tag: "conditional", type: "multi", label: "Stress affects",
      options: [
        "Food intake", "Cravings", "Meal timing", "Sleep", "Training consistency",
        "Performance", "Digestion", "No noticeable effect",
      ],
      showIf: (a) => answered(a, "q62"),
    },
    {
      id: "q63", n: 63, tag: "core", type: "single",
      label: "How much fluid do you normally drink?",
      options: [
        "Less than 1 litre", "1–1.5 litres", "1.5–2 litres", "2–3 litres",
        "More than 3 litres", "Not sure",
      ],
    },
    {
      id: "q63a", tag: "conditional", type: "multi", label: "Higher fluid demand from",
      options: [
        "Hot climate", "Heavy sweating", "Long workouts", "Outdoor training",
        "Endurance exercise", "Physical job", "Frequent travel", "None",
      ],
    },
    {
      id: "q63b", tag: "conditional", type: "single", label: "Electrolytes",
      options: ["Regularly", "Sometimes", "Only during long or hard exercise", "Never", "Unsure when required"],
    },
    {
      id: "q64", n: 64, tag: "core", type: "multi",
      label: "Which caffeine products do you use?",
      options: ["Tea", "Coffee", "Energy drink", "Pre-workout", "Caffeine tablet", "None"],
    },
    {
      id: "q64a", tag: "conditional", type: "number", label: "Daily servings",
      showIf: (a) => hasOther(a, "q64", ["None"]),
    },
    {
      id: "q64c", tag: "conditional", type: "single", label: "Sugar added to caffeine drinks",
      options: ["No", "Yes", "Sometimes"],
      showIf: (a) => hasOther(a, "q64", ["None"]),
    },
    {
      id: "q64b", tag: "conditional", type: "single", label: "Last caffeine of the day",
      options: ["Before 12 PM", "12–3 PM", "3–6 PM", "6–9 PM", "After 9 PM", "Variable"],
      showIf: (a) => hasOther(a, "q64", ["None"]),
    },
    {
      id: "q65", n: 65, tag: "core", type: "multi",
      label: "Do you use alcohol, nicotine or tobacco?",
      options: [
        "Alcohol", "Cigarette", "Vaping", "Chewing tobacco", "Other nicotine or tobacco",
        "None", "Prefer not to answer",
      ],
    },
    {
      id: "q65a", tag: "conditional", type: "single", label: "Frequency",
      options: ["Daily", "4–6 times weekly", "2–3 times weekly", "Weekly", "Monthly", "Occasionally"],
      showIf: (a) => hasOther(a, "q65", ["None", "Prefer not to answer"]),
    },
    {
      id: "q65b", tag: "conditional", type: "multi", label: "Typical situation",
      options: ["Routine use", "Social", "Weekend", "Stress-related", "Travel", "Other"],
      showIf: (a) => hasOther(a, "q65", ["None", "Prefer not to answer"]),
    },
    {
      id: "q66", n: 66, tag: "clinical", type: "multi",
      label: "Are there hormonal, menstrual or reproductive considerations relevant to nutrition?",
      options: [
        "Regular cycle", "Irregular cycle", "Missed periods", "Heavy bleeding",
        "Significant menstrual pain", "PCOS or PCOD", "Endometriosis", "Pregnant",
        "Trying to conceive", "Breastfeeding", "Postpartum", "Perimenopause", "Menopause",
        "Nothing relevant", "Not applicable", "Prefer not to answer", "Other",
      ],
      showIf: (a) => !is(a, "gender", "Male"),
    },
    {
      id: "q66a", tag: "clinical", type: "single", label: "Medical care for this",
      options: ["Under medical care", "Previously assessed", "Not assessed", "Not required", "Client unsure"],
      showIf: (a) =>
        !is(a, "gender", "Male") &&
        hasOther(a, "q66", ["Nothing relevant", "Not applicable", "Prefer not to answer"]),
    },
    {
      id: "q67", n: 67, tag: "core", type: "multi",
      label: "How often do travel or social situations affect your food routine?",
      options: [
        "Work travel", "Personal travel", "Flights or airports", "Hotel stays",
        "Business dinners", "Restaurants", "Family gatherings", "Parties or social events",
        "International travel", "Religious or community events", "Rarely affected", "Other",
      ],
    },
    {
      id: "q67a", tag: "conditional", type: "multi", label: "What usually happens?",
      options: [
        "Skip meals", "Eat very little beforehand", "Overeat", "Drink alcohol",
        "Eat whatever is available", "Struggle with protein", "Eat late",
        "Order familiar foods", "Carry snacks", "Manage reasonably well",
      ],
      showIf: (a) => hasOther(a, "q67", ["Rarely affected"]),
    },
    {
      id: "q67b", tag: "conditional", type: "single", label: "How often?",
      options: ["Rarely", "1–2 times per month", "Weekly", "Multiple times per week", "Frequent traveller"],
      showIf: (a) => hasOther(a, "q67", ["Rarely affected"]),
    },
  ],
};

// ---------------------------------------------------------------------------
// SECTION 10 — CLIENT SUCCESS, DROPOUT RISK AND COACHING PROFILE (Q68–Q75)
// ---------------------------------------------------------------------------

const S10: Section = {
  id: "coaching",
  code: "10",
  title: "Success pattern, dropout risk & coaching profile",
  stage: "Behaviour",
  minutes: "5–6 min",
  intro:
    "The AI generates the Dropout Trigger, Dropout Behaviour Pattern, Early Warning Signals, Intervention Style, Accountability Need, Education Preference, Communication Style and Check-In Need from this section.",
  questions: [
    {
      id: "q68", n: 68, tag: "core", type: "multi", max: 3,
      label: "When you usually stop following a health plan, what normally happens first?",
      options: [
        "Work becomes busy", "Travel starts", "Weekend routine breaks",
        "Miss one meal and lose momentum", "Miss one workout and lose momentum",
        "Weight does not reduce quickly", "Inches do not change quickly", "Hunger increases",
        "Cravings increase", "Feel too restricted", "Food becomes repetitive",
        "Cooking becomes difficult", "Meal preparation stops", "Family routine changes",
        "Social events increase", "Restaurant eating increases", "Stress increases",
        "Sleep becomes poor", "Motivation reduces", "Stop tracking", "Stop checking weight",
        "Stop replying to Dietitian or coach", "Feel guilty after off-plan eating",
        "Think the plan is already ruined", "Compensate by eating less",
        "Lose confidence after slow progress", "Illness", "Injury",
        "Never followed a plan long enough", "Do not know", "Other",
      ],
    },
    {
      id: "q69", n: 69, tag: "core", type: "multi",
      label: "What do you normally do after your routine goes off-plan?",
      options: [
        "Return to plan at the next meal", "Return the next day", "Wait until Monday",
        "Reduce food significantly", "Skip meals", "Exercise more", "Continue off-plan eating",
        "Avoid checking weight", "Stop tracking", "Stop communicating",
        "Feel guilty but continue trying", "Completely stop the plan", "Variable", "Not sure",
      ],
    },
    {
      id: "q70", n: 70, tag: "core", type: "multi", max: 3,
      label: "What type of support helps you stay consistent?",
      options: [
        "Direct accountability", "Strict follow-up", "Gentle reminders", "Encouragement",
        "Detailed explanations", "Simple instructions", "Clear weekly targets",
        "Frequent check-ins", "Progress-data feedback", "Problem-solving support",
        "Flexible approach", "Independent approach", "Challenge me when I make excuses",
        "Celebrate small progress", "Help me recover after an off-plan day", "Not sure",
      ],
    },
    {
      id: "q71", n: 71, tag: "core", type: "multi",
      label: "Which nutrition or fitness beliefs currently influence your choices?",
      options: [
        "Carbohydrates cause weight gain", "Rice causes weight gain", "Roti causes weight gain",
        "Avoid food after a specific time", "Skipping meals helps fat loss",
        "Fasting is necessary", "Fruit has too much sugar", "Dietary fat should be avoided",
        "Very high protein is necessary", "Protein damages kidneys or liver",
        "Protein powder is unsafe", "Supplements are necessary", "Detox or cleanse is required",
        "More sweating means more fat loss", "Fasted workout significantly increases fat loss",
        "Social-media nutrition influences choices", "No strong belief affecting choices", "Other",
      ],
    },
    {
      id: "q71a", tag: "conditional", type: "single", label: "Restriction caused by these beliefs",
      options: ["None", "Mild", "Moderate", "Significant"],
      showIf: (a) => hasOther(a, "q71", ["No strong belief affecting choices"]),
    },
    {
      id: "q72", n: 72, tag: "planning", type: "single",
      label: "What type of diet structure would you prefer?",
      options: [
        "Exact fixed diet", "Two options per meal", "Multiple choices", "Flexible food exchange",
        "Portion-based guidance", "Dietitian and AI should decide", "Not sure",
      ],
    },
    {
      id: "q72a", tag: "planning", type: "single", label: "Preferred portion explanation",
      options: ["Grams", "Katori, cup or spoon", "Hand portions", "Visual plate", "Combination", "No preference"],
    },
    {
      id: "q73", n: 73, tag: "planning", type: "multi", max: 3,
      label: "What are your top three barriers to following a nutrition plan?",
      note: RANK_NOTE,
      options: [
        "Work", "Travel", "Family routine", "Cooking", "Meal preparation", "Cost",
        "Food availability", "Cravings", "Hunger", "Low appetite", "Stress or emotional eating",
        "Social events", "Restaurant food", "Alcohol", "Poor sleep", "Low motivation",
        "Forgetfulness", "Carrying food", "Household food difference", "Fear of restriction",
        "Previous diet fatigue", "Training schedule", "No major barrier", "Other",
      ],
    },
    {
      id: "q74", n: 74, tag: "planning", type: "single",
      label: "How much change feels realistic during the first two weeks?",
      options: [
        "1–2 small changes", "3 focused changes", "Moderate routine restructuring",
        "Highly structured plan", "Need a very flexible approach", "Need professional guidance",
      ],
    },
    {
      id: "q74a", tag: "core", type: "textarea",
      label: "Is there anything important about your health, food, routine, training or goal that we have not discussed?",
      placeholder: "Client's own words — leave blank if nothing.",
    },
    {
      id: "q75", n: 75, tag: "core", type: "scale10",
      label: "How confident are you that you can follow a plan designed around your routine? (1–10)",
    },
    {
      id: "q75a", tag: "conditional", type: "multi", max: 3,
      label: "What would make the plan easier?",
      options: [
        "Fewer changes", "More meal options", "Simpler foods", "Lower-cost foods",
        "Less cooking", "Flexible portions", "Travel options", "Restaurant guidance",
        "Keep favourite foods", "Better workout-day guidance", "Family-compatible meals",
        "More explanation", "More accountability", "More frequent check-ins", "Other",
      ],
      showIf: (a) => scaleAtMost(a, "q75", 6),
    },
  ],
};

// ---------------------------------------------------------------------------
// SECTION 11 — DIETITIAN PROFESSIONAL ASSESSMENT (Q76–Q101)
// The answers are the dietitian's professional hypothesis — NOT automatically
// the final strategy. The AI independently assesses the complete client data
// before accepting, modifying or replacing this hypothesis.
// ---------------------------------------------------------------------------

const S11: Section = {
  id: "assessment",
  code: "11",
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

// ---------------------------------------------------------------------------
// SECTION 12 — CLIENT STRATEGY DISCUSSION (Q102–Q105)
// ---------------------------------------------------------------------------

const S12: Section = {
  id: "discussion",
  code: "12",
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

// ---------------------------------------------------------------------------

export const SECTIONS: Section[] = [CLIENT, S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12];

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
      if (q.required && !answered(a, q.id))
        out.push({ sectionId: s.id, sectionTitle: s.title, questionId: q.id, label: q.label });
  return out;
}

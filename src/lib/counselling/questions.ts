// ---------------------------------------------------------------------------
// LeanR First Clinical Nutrition & Fitness Counselling — question bank.
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

export type QuestionType =
  | "text"
  | "textarea"
  | "number"
  | "time"
  | "single"
  | "multi"
  | "scale10";

export type Answers = Record<string, string | string[]>;

export type QuestionTag = "core" | "conditional" | "clinical" | "fitness" | "planning";

export interface Question {
  id: string;
  /** Original number in the LeanR bank — shown to the dietitian. */
  n?: number;
  label: string;
  type: QuestionType;
  tag?: QuestionTag;
  options?: string[];
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
  /** A–AD from the bank, or a branch/summary marker. */
  code: string;
  title: string;
  stage: Stage;
  minutes?: string;
  intro?: string;
  questions: Question[];
  /** Clinical/fitness branches only appear once activated by earlier answers. */
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
  | "Branches"
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

const YES_NO = ["Yes", "No"];
const YES_NO_UNSURE = ["Yes", "No", "Not sure"];
const FREQ = ["Frequently", "Sometimes", "Rarely", "Never"];

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
// A — WELCOME & CLIENT EXPECTATIONS (Q1–Q10)
// ---------------------------------------------------------------------------

const A: Section = {
  id: "welcome",
  code: "A",
  title: "Welcome & expectations",
  stage: "Goals",
  minutes: "3–5 min",
  intro:
    "Set expectations: today is about understanding the client, not handing over a diet chart.",
  questions: [
    {
      id: "q1", n: 1, tag: "core", type: "textarea",
      label: "Before we start, what made you decide to join LeanR?",
      probe: "Why now specifically?",
      why: "Identifies the emotional and practical trigger; personalises coaching communication.",
    },
    {
      id: "q2", n: 2, tag: "core", type: "multi",
      label: "What is the biggest change you want to see in yourself?",
      options: [
        "Reduce body fat", "Reduce weight", "Reduce belly fat", "Improve body shape",
        "Gain muscle", "Improve muscle tone", "Improve strength", "Improve stamina",
        "Improve gym performance", "Improve energy", "Improve health markers",
        "Feel more confident", "Improve mobility", "Other",
      ],
      probe: "If you could choose only one, which would be most important?",
    },
    {
      id: "q3", n: 3, tag: "core", type: "textarea",
      label: 'At the end of your LeanR journey, what result would make you say, "This programme worked for me"?',
      probe: "What would you see, feel or be able to do differently?",
    },
    {
      id: "q4", n: 4, tag: "core", type: "single",
      label: "Which statement best describes your goal?",
      options: [
        "I mainly want the number on the weighing scale to reduce",
        "I want to reduce fat and look leaner",
        "I want to reduce fat while maintaining muscle",
        "I want to lose fat and gain muscle",
        "I mainly want to gain muscle",
        "I want better muscle definition",
        "I want to improve fitness and strength",
        "I am not sure",
      ],
      why: "Differentiates weight loss from body recomposition — drives the whole plan.",
    },
    {
      id: "q5", n: 5, tag: "core", type: "multi",
      label: "Is there any specific body area you are most concerned about?",
      options: [
        "Upper abdomen", "Lower abdomen", "Love handles", "Chest", "Back", "Arms",
        "Hips", "Thighs", "Glutes", "Face", "Overall body fat", "Low muscle mass",
        "Loose skin", "No specific area",
      ],
      note: "Do not promise targeted fat reduction.",
    },
    {
      id: "q6", n: 6, tag: "core", type: "single",
      label: "Do you have a target weight in mind?",
      options: YES_NO_UNSURE,
    },
    {
      id: "q6a", tag: "conditional", type: "number",
      label: "Target weight (kg)",
      showIf: (a) => is(a, "q6", "Yes"),
    },
    {
      id: "q7", n: 7, tag: "core", type: "textarea",
      label: "Why is that particular target weight important to you?",
      probe: "Have you been at this weight previously?",
      showIf: (a) => is(a, "q6", "Yes"),
    },
    {
      id: "q8", n: 8, tag: "core", type: "multi",
      label: "Do you have any target date or upcoming event?",
      options: [
        "Wedding", "Vacation", "Birthday", "Sports event", "Medical recommendation",
        "Photoshoot", "Festival", "Personal milestone", "No fixed date", "Other",
      ],
    },
    {
      id: "q9", n: 9, tag: "core", type: "scale10",
      label: "On a scale of 1–10, how important is this transformation to you right now?",
    },
    {
      id: "q10", n: 10, tag: "core", type: "textarea",
      label: "Why did you choose this number and not a lower number?",
      why: "Motivational interviewing — surfaces the client's own reasons to change.",
      showIf: (a) => answered(a, "q9"),
    },
  ],
};

// ---------------------------------------------------------------------------
// B — BODY & WEIGHT JOURNEY (Q11–Q30)
// ---------------------------------------------------------------------------

const B: Section = {
  id: "body",
  code: "B",
  title: "Body & weight journey",
  stage: "Goals",
  minutes: "5–7 min",
  questions: [
    { id: "q11", n: 11, tag: "core", type: "number", label: "Current weight (kg)" },
    { id: "q12", n: 12, tag: "core", type: "number", label: "Height (cm)" },
    { id: "q13", n: 13, tag: "core", type: "number", label: "Age" },
    { id: "q14", n: 14, type: "text", label: "Weight approximately one year ago (kg)", placeholder: "e.g. 78 · or “don't know”" },
    { id: "q15", n: 15, type: "text", label: "Weight approximately three years ago (kg)", placeholder: "e.g. 70 · or “don't know”" },
    { id: "q16", n: 16, type: "text", label: "Highest adult weight (kg)" },
    { id: "q17", n: 17, type: "text", label: "Lowest adult weight after 18 (kg)" },
    { id: "q18", n: 18, type: "text", label: "At what weight did you feel healthiest and most comfortable?" },
    { id: "q19", n: 19, type: "text", label: "When did you first notice a significant change in your weight or body composition?" },
    {
      id: "q20", n: 20, type: "single", label: "Was the change:",
      options: ["Sudden", "Gradual", "Repeated gain and loss", "Mainly after a specific event", "Not sure"],
    },
    {
      id: "q21", n: 21, type: "multi",
      label: "Was the body change associated with any of the following?",
      options: [
        "New job", "Desk job", "Work from home", "Marriage", "Pregnancy", "Postpartum",
        "Menopause/perimenopause", "Relocation", "International relocation", "Stress",
        "Injury", "Surgery", "Medication", "Medical diagnosis", "Stopped gym",
        "Reduced walking", "Night shift", "COVID period", "Emotional eating",
        "Sleep changes", "Other",
      ],
    },
    {
      id: "q22", n: 22, tag: "core", type: "single",
      label: "During the last six months, your weight has:",
      options: [
        "Increased significantly", "Increased slightly", "Remained stable",
        "Reduced slightly", "Reduced significantly", "Fluctuated frequently",
      ],
    },
    {
      id: "q23", n: 23, type: "single", label: "How easily do you generally gain weight?",
      options: ["Very easily", "Moderately easily", "Only when lifestyle changes", "Difficult to gain", "Not sure"],
    },
    {
      id: "q24", n: 24, type: "single", label: "How easily do you generally lose weight?",
      options: ["Very easily", "Initially easily, then it stops", "Slowly", "Very difficult", "Never seriously tried"],
    },
    { id: "q25", n: 25, type: "single", label: "Have you experienced a weight-loss plateau?", options: YES_NO_UNSURE },
    {
      id: "q26", n: 26, tag: "conditional", type: "single",
      label: "For how long did your weight remain stuck?",
      options: ["Less than 2 weeks", "2–4 weeks", "1–3 months", "More than 3 months"],
      showIf: (a) => is(a, "q25", "Yes"),
    },
    {
      id: "q27", n: 27, type: "single",
      label: "Did your measurements or clothes change even when weight was stuck?",
      options: ["Yes", "No", "Did not measure", "Not sure"],
      showIf: (a) => is(a, "q25", "Yes"),
    },
    {
      id: "q28", n: 28, tag: "fitness", type: "single",
      label: "Have you noticed loss of strength or muscle during previous weight-loss attempts?",
      options: YES_NO_UNSURE,
    },
    {
      id: "q29", n: 29, type: "single", label: "Have your clothing sizes changed in the last year?",
      options: ["Increased", "Decreased", "No change", "Fluctuating"],
    },
    {
      id: "q30", n: 30, tag: "planning", type: "single", label: "Which matters more to you?",
      options: ["Scale weight", "Inches", "Body appearance", "Muscle definition", "Strength", "Health markers", "Overall combination"],
    },
  ],
};

// ---------------------------------------------------------------------------
// C — BODY COMPOSITION (Q31–Q40)
// ---------------------------------------------------------------------------

const C: Section = {
  id: "composition",
  code: "C",
  title: "Body composition",
  stage: "Goals",
  minutes: "3–5 min",
  questions: [
    { id: "q31", n: 31, type: "single", label: "Have you ever had a body composition assessment?", options: YES_NO_UNSURE },
    {
      id: "q32", n: 32, tag: "conditional", type: "single", label: "Which assessment was used?",
      options: ["Smart scale", "BIA machine", "DEXA", "Skinfold", "Gym machine", "Other", "Don't know"],
      showIf: (a) => is(a, "q31", "Yes"),
    },
    { id: "q33", n: 33, type: "text", label: "Body fat % (with assessment date, if known)", placeholder: "e.g. 34% — May 2026" },
    { id: "q34", n: 34, type: "text", label: "Skeletal muscle mass / muscle % (if known)" },
    { id: "q35", n: 35, type: "text", label: "Visceral fat reading (if known)" },
    { id: "q36", n: 36, type: "text", label: "Waist circumference (if known)" },
    {
      id: "q37", n: 37, tag: "fitness", type: "single", label: "How would you describe your current body?",
      options: [
        "Higher body fat with low muscle", "Higher body fat with good muscle",
        "Average body fat with low muscle", "Lean but want more muscle",
        "Underweight", "Athletic", "Not sure",
      ],
      note: "Client perception is not a clinical body composition diagnosis.",
    },
    {
      id: "q38", n: 38, type: "single",
      label: "Do you feel your body looks soft despite your weight being normal?",
      options: YES_NO_UNSURE,
      why: "Positive answer → explore a body recomposition goal rather than weight loss.",
    },
    { id: "q39", n: 39, type: "single", label: "Have you recently lost a significant amount of weight?", options: YES_NO },
    {
      id: "q40", n: 40, tag: "conditional", type: "multi",
      label: "After weight loss, are you concerned about:",
      options: ["Loose skin", "Low muscle tone", "Weakness", "Muscle loss", "Weight regain", "All of these", "Other"],
      showIf: (a) => is(a, "q39", "Yes"),
    },
  ],
};

// ---------------------------------------------------------------------------
// D — MEDICAL SCREENING (Q41–Q55)
// ---------------------------------------------------------------------------

export const CONDITIONS = [
  "Diabetes", "Prediabetes", "Insulin resistance", "PCOS/PCOD", "Hypothyroidism",
  "Hyperthyroidism", "Hypertension", "High cholesterol/triglycerides", "Fatty liver",
  "Other liver condition", "Kidney disease", "Kidney stones", "Gallstones",
  "Gallbladder removed", "GERD/reflux", "Gastritis", "IBS", "IBD", "Coeliac disease",
  "Gout", "High uric acid", "Anaemia", "Vitamin B12 deficiency", "Vitamin D deficiency",
  "Arthritis", "Osteoporosis", "Heart disease", "Asthma", "Sleep apnoea",
  "Autoimmune condition", "Neurological condition", "Cancer history", "Other", "None known",
];

const D: Section = {
  id: "medical",
  code: "D",
  title: "Medical screening",
  stage: "Clinical",
  minutes: "8–12 min",
  intro: "Clinical safety comes before diet design. Red flags stop the plan and trigger referral.",
  questions: [
    {
      id: "q41", n: 41, tag: "clinical", type: "multi",
      label: "Have you been diagnosed with any medical condition?",
      options: CONDITIONS,
    },
    {
      id: "q42", n: 42, tag: "conditional", type: "single", label: "Who diagnosed the condition?",
      options: ["Physician", "Specialist", "Hospital", "Based on blood reports", "Self-assumed", "Other"],
      showIf: (a) => list(a, "q41").some((c) => c !== "None known"),
    },
    {
      id: "q43", n: 43, tag: "conditional", type: "text", label: "When were you diagnosed?",
      placeholder: "e.g. March 2024 / about 3 years ago",
      showIf: (a) => list(a, "q41").some((c) => c !== "None known"),
    },
    {
      id: "q44", n: 44, tag: "conditional", type: "single", label: "Is the condition currently:",
      options: ["Well controlled", "Partially controlled", "Uncontrolled", "Under investigation", "Don't know"],
      showIf: (a) => list(a, "q41").some((c) => c !== "None known"),
    },
    {
      id: "q45", n: 45, tag: "conditional", type: "single", label: "Are you currently under a doctor's care for this condition?",
      options: ["Yes", "No", "Follow-up pending"],
      showIf: (a) => list(a, "q41").some((c) => c !== "None known"),
    },
    {
      id: "q46", n: 46, tag: "clinical", type: "single",
      label: "Have you been advised any food restriction by your doctor?",
      options: YES_NO,
    },
    {
      id: "q46a", tag: "conditional", type: "textarea", label: "Exact restriction advised",
      placeholder: "Record the doctor's words — this overrides plan design.",
      showIf: (a) => is(a, "q46", "Yes"),
    },
    { id: "q47", n: 47, tag: "clinical", type: "single", label: "Have you ever been hospitalised for a major medical condition?", options: YES_NO },
    { id: "q48", n: 48, tag: "clinical", type: "single", label: "Have you undergone any major surgery?", options: YES_NO },
    {
      id: "q48a", tag: "conditional", type: "textarea", label: "Surgery, date and current limitations",
      showIf: (a) => is(a, "q48", "Yes"),
    },
    {
      id: "q49", n: 49, tag: "clinical", type: "single",
      label: "Do you currently experience unexplained chest pain?",
      options: YES_NO,
      note: "RED FLAG — medical evaluation before intensive exercise.",
    },
    {
      id: "q50", n: 50, tag: "clinical", type: "single",
      label: "Do you experience fainting or unexplained loss of consciousness?",
      options: YES_NO,
      note: "RED FLAG",
    },
    {
      id: "q51", n: 51, tag: "clinical", type: "single",
      label: "Do you experience unusual breathlessness with mild activity?",
      options: ["Yes", "No", "Sometimes"],
    },
    {
      id: "q52", n: 52, tag: "clinical", type: "single", label: "Do you experience frequent dizziness?",
      options: ["Yes", "No", "Sometimes"],
    },
    { id: "q53", n: 53, tag: "clinical", type: "single", label: "Have you had any unexplained rapid weight loss?", options: YES_NO },
    { id: "q54", n: 54, tag: "clinical", type: "single", label: "Have you had any unexplained rapid weight gain or significant swelling?", options: YES_NO },
    {
      id: "q55", n: 55, tag: "clinical", type: "single",
      label: "Do you currently have a medical condition for which your doctor has restricted exercise?",
      options: YES_NO_UNSURE,
      note: "PT handover required.",
    },
  ],
};

// ---------------------------------------------------------------------------
// E — MEDICATION (Q56–Q60)
// ---------------------------------------------------------------------------

const E: Section = {
  id: "medication",
  code: "E",
  title: "Medication",
  stage: "Clinical",
  minutes: "3–5 min",
  questions: [
    { id: "q56", n: 56, tag: "clinical", type: "single", label: "Are you taking any prescribed medicines regularly?", options: YES_NO },
    {
      id: "q57", n: 57, tag: "conditional", type: "textarea",
      label: "Medicines — name, dose, timing, frequency, reason, duration",
      placeholder: "Metformin 500 mg · after breakfast & dinner · daily · diabetes · 2 years\nThyronorm 50 mcg · empty stomach 6:30 am · daily · hypothyroid · 4 years",
      showIf: (a) => is(a, "q56", "Yes"),
    },
    {
      id: "q58", n: 58, tag: "clinical", type: "single", label: "Have any medicines been started or changed recently?",
      options: YES_NO, showIf: (a) => is(a, "q56", "Yes"),
    },
    {
      id: "q59", n: 59, type: "single", label: "Do you sometimes miss your prescribed medicine?",
      options: FREQ, showIf: (a) => is(a, "q56", "Yes"),
      note: "Do not independently modify medication.",
    },
    {
      id: "q60", n: 60, type: "multi", label: "Do you regularly take:",
      options: ["Antacid", "Laxative", "Painkiller", "Sleep medication", "OTC medication", "None", "Other"],
    },
  ],
};

// ---------------------------------------------------------------------------
// F — SUPPLEMENTS (Q61–Q67)
// ---------------------------------------------------------------------------

const F: Section = {
  id: "supplements",
  code: "F",
  title: "Supplements",
  stage: "Clinical",
  minutes: "3–4 min",
  questions: [
    { id: "q61", n: 61, type: "single", label: "Are you currently using any nutrition or fitness supplements?", options: YES_NO },
    {
      id: "q62", n: 62, tag: "conditional", type: "multi", label: "Which supplements?",
      options: [
        "Whey protein", "Plant protein", "Creatine", "BCAA", "EAA", "Pre-workout",
        "Electrolytes", "Multivitamin", "Vitamin D", "Vitamin B12", "Iron", "Calcium",
        "Omega-3", "Magnesium", "Probiotic", "Mass gainer", "Fat burner",
        "Herbal supplement", "Ayurvedic product", "Other",
      ],
      showIf: (a) => is(a, "q61", "Yes"),
    },
    {
      id: "q63", n: 63, tag: "conditional", type: "single", label: "Who recommended the supplement?",
      options: ["Doctor", "Dietitian", "Trainer", "Friend", "Social media", "Self-research", "Supplement seller", "Other"],
      showIf: (a) => is(a, "q61", "Yes"),
    },
    {
      id: "q64", n: 64, tag: "conditional", type: "text", label: "How much do you take?",
      showIf: (a) => is(a, "q61", "Yes"),
    },
    {
      id: "q65", n: 65, tag: "conditional", type: "single", label: "How often?",
      options: ["Daily", "Training days", "Occasionally", "Irregular"],
      showIf: (a) => is(a, "q61", "Yes"),
    },
    {
      id: "q66", n: 66, tag: "conditional", type: "multi", label: "Have you experienced any side effects?",
      options: [
        "Digestive discomfort", "Bloating", "Diarrhoea", "Constipation", "Palpitations",
        "Sleep disturbance", "Headache", "Other", "None",
      ],
      showIf: (a) => is(a, "q61", "Yes"),
    },
    {
      id: "q67", n: 67, tag: "fitness", type: "single",
      label: "Have you ever used bodybuilding or performance-enhancing substances?",
      options: ["No", "Prefer not to answer", "Previously", "Currently"],
      note: "Keep the discussion non-judgemental; escalate medically where appropriate.",
    },
  ],
};

// ---------------------------------------------------------------------------
// G — BLOOD REPORTS (Q68–Q73)
// ---------------------------------------------------------------------------

const G: Section = {
  id: "reports",
  code: "G",
  title: "Blood reports",
  stage: "Clinical",
  minutes: "3–5 min",
  questions: [
    {
      id: "q68", n: 68, tag: "clinical", type: "single", label: "When did you last have blood tests?",
      options: ["Within 3 months", "3–6 months", "6–12 months", "More than one year", "Never/Don't remember"],
    },
    { id: "q69", n: 69, type: "single", label: "Are your reports available?", options: ["Yes", "No", "Can arrange"] },
    {
      id: "q70", n: 70, type: "single", label: "Why were the tests performed?",
      options: ["Routine check", "Medical condition", "Symptoms", "Doctor recommendation", "Fitness check", "Other"],
    },
    { id: "q71", n: 71, tag: "clinical", type: "single", label: "Have you ever been told that any blood value was abnormal?", options: ["Yes", "No", "Don't know"] },
    {
      id: "q72", n: 72, tag: "conditional", type: "multi", label: "Which values were abnormal?",
      options: [
        "Blood glucose", "HbA1c", "Cholesterol", "Triglycerides", "Liver enzymes",
        "Kidney markers", "Thyroid", "Haemoglobin", "Iron/ferritin", "Vitamin D",
        "Vitamin B12", "Uric acid", "Other",
      ],
      showIf: (a) => is(a, "q71", "Yes"),
    },
    { id: "q72a", tag: "conditional", type: "textarea", label: "Report values / dietitian notes on the reports", showIf: (a) => is(a, "q71", "Yes") },
    { id: "q73", n: 73, type: "single", label: "Are repeat investigations pending?", options: YES_NO_UNSURE },
  ],
};

// ---------------------------------------------------------------------------
// H — 24-HOUR DIET RECALL (Q74–Q107)
// ---------------------------------------------------------------------------

const PORTION_HINT =
  "Quantify: katori / bowl / cup / rotis (number + size) / spoons / grams / pieces / palm / fist / packet size.";

const H: Section = {
  id: "recall",
  code: "H",
  title: "24-hour diet recall",
  stage: "Diet",
  minutes: "12–18 min",
  intro:
    "Walk through yesterday hour by hour. Ask quantity and preparation for every item — this is the single most valuable section of the counselling.",
  questions: [
    { id: "q74", n: 74, tag: "planning", type: "time", label: "What time did you wake up yesterday?" },
    {
      id: "q75", n: 75, type: "single", label: "First thing consumed after waking",
      options: ["Water", "Tea", "Coffee", "Lemon water", "Herbal beverage", "Juice", "Food", "Nothing", "Other"],
    },
    {
      id: "q76", n: 76, type: "single", label: "How much water did you drink after waking?",
      options: ["None", "Less than 1 glass", "1 glass", "2+ glasses"],
    },
    { id: "q77", n: 77, type: "single", label: "Do you drink tea or coffee in the morning?", options: ["Tea", "Coffee", "Both", "Neither"] },
    {
      id: "q78", n: 78, tag: "planning", type: "textarea", label: "How is it prepared?",
      placeholder: "Milk quantity, sugar, sweetener, cream, serving size",
      showIf: (a) => !is(a, "q77", "Neither") && answered(a, "q77"),
    },
    { id: "q79", n: 79, tag: "planning", type: "time", label: "What time did you have your first actual meal?" },
    { id: "q80", n: 80, tag: "planning", type: "textarea", label: "What exactly did you eat? (first meal)" },
    { id: "q81", n: 81, tag: "planning", type: "textarea", label: "How much did you eat?", placeholder: PORTION_HINT },
    {
      id: "q82", n: 82, type: "multi", label: "How was the food prepared?",
      options: ["Boiled", "Steamed", "Grilled", "Air fried", "Shallow fried", "Deep fried", "Roasted", "Curry", "Other"],
    },
    {
      id: "q83", n: 83, type: "single", label: "Who prepared the meal?",
      options: ["Self", "Family", "Cook", "Office", "Restaurant", "Food delivery", "Packaged food"],
    },
    { id: "q84", n: 84, type: "scale10", label: "How hungry were you before eating? (0–10)" },
    { id: "q85", n: 85, type: "scale10", label: "How full were you after eating? (0–10)" },
    { id: "q86", n: 86, type: "single", label: "Were you satisfied with the meal?", options: ["Completely", "Mostly", "Partially", "No"] },
    {
      id: "q87", n: 87, type: "multi", label: "Did you eat while:",
      options: ["Watching TV", "Using phone", "Working", "Driving", "Talking", "Sitting without distraction"],
    },
    { id: "q88", n: 88, tag: "planning", type: "textarea", label: "Between breakfast and lunch — all food and beverages" },
    { id: "q89", n: 89, tag: "planning", type: "time", label: "What time did you have lunch?" },
    {
      id: "q90", n: 90, tag: "planning", type: "textarea", label: "Describe your complete lunch plate",
      placeholder: "Grain · protein source · vegetable · dairy · salad · beverage · dessert · condiments",
    },
    { id: "q91", n: 91, tag: "planning", type: "text", label: "How much roti / rice / bread / grain at lunch?", placeholder: PORTION_HINT },
    {
      id: "q92", n: 92, tag: "planning", type: "multi", label: "Main protein source at lunch",
      options: [
        "Dal", "Beans", "Paneer", "Tofu", "Soy", "Curd", "Eggs", "Chicken", "Fish",
        "Meat", "Protein supplement", "No clear protein source", "Other",
      ],
    },
    { id: "q93", n: 93, type: "textarea", label: "After lunch until evening — everything consumed" },
    { id: "q94", n: 94, type: "single", label: "Do you experience an afternoon energy crash?", options: ["Daily", "Frequently", "Sometimes", "Rarely", "Never"] },
    {
      id: "q95", n: 95, type: "multi", label: "What do you usually crave in the evening?",
      options: ["Tea/coffee", "Sweet", "Salty", "Fried food", "Bakery food", "Fast food", "Nothing", "Other"],
    },
    { id: "q96", n: 96, tag: "planning", type: "textarea", label: "What did you eat yesterday evening?" },
    { id: "q97", n: 97, tag: "fitness", type: "single", label: "Did you train yesterday?", options: YES_NO },
    {
      id: "q98", n: 98, tag: "conditional", type: "textarea", label: "Pre-workout food — what, how much, how long before",
      showIf: (a) => is(a, "q97", "Yes"),
    },
    {
      id: "q99", n: 99, tag: "conditional", type: "multi", label: "During training you consumed:",
      options: ["Water", "Electrolyte", "Sports drink", "BCAA/EAA", "Carbohydrate drink", "Nothing", "Other"],
      showIf: (a) => is(a, "q97", "Yes"),
    },
    { id: "q100", n: 100, tag: "conditional", type: "textarea", label: "What did you consume after training?", showIf: (a) => is(a, "q97", "Yes") },
    {
      id: "q101", n: 101, tag: "conditional", type: "single", label: "How long after training did you eat?",
      options: ["Within 30 minutes", "30–60 minutes", "1–2 hours", "More than 2 hours", "Did not eat"],
      showIf: (a) => is(a, "q97", "Yes"),
    },
    { id: "q102", n: 102, tag: "planning", type: "time", label: "What time did you have dinner?" },
    { id: "q103", n: 103, tag: "planning", type: "textarea", label: "Describe your complete dinner", placeholder: PORTION_HINT },
    { id: "q104", n: 104, type: "textarea", label: "Anything after dinner?", placeholder: "Leave empty if nothing" },
    { id: "q105", n: 105, type: "time", label: "What time did you sleep?" },
    {
      id: "q106", n: 106, type: "single", label: "How typical was yesterday's food?",
      options: ["Exactly my normal routine", "Mostly normal", "Slightly different", "Very different"],
    },
    {
      id: "q107", n: 107, tag: "planning", type: "textarea", label: "What would be different on a normal day?",
      showIf: (a) => !is(a, "q106", "Exactly my normal routine") && answered(a, "q106"),
    },
  ],
};

// ---------------------------------------------------------------------------
// I — WEEKLY FOOD PATTERN (Q108–Q114)
// ---------------------------------------------------------------------------

const I: Section = {
  id: "weekly",
  code: "I",
  title: "Weekly food pattern",
  stage: "Diet",
  minutes: "4–6 min",
  questions: [
    {
      id: "q108", n: 108, tag: "planning", type: "multi", label: "How different is your weekend diet?",
      options: [
        "Same", "Slightly different", "Much heavier", "More restaurant food",
        "More alcohol", "More sweets/snacks", "I skip meals", "Other",
      ],
    },
    { id: "q109", n: 109, tag: "planning", type: "single", label: "How many meals per week do you eat outside?", options: ["0", "1–2", "3–5", "6–10", "More than 10"] },
    {
      id: "q110", n: 110, type: "single", label: "How often do you order food?",
      options: ["Daily", "4–6 times/week", "2–3 times/week", "Once/week", "Rarely", "Never"],
    },
    {
      id: "q111", n: 111, type: "multi", label: "Which cuisines do you commonly order?",
      options: [
        "North Indian", "South Indian", "Chinese", "Italian", "Middle Eastern",
        "Fast food", "Continental", "Japanese", "Mexican", "Local cuisine", "Other",
      ],
    },
    { id: "q112", n: 112, tag: "planning", type: "number", label: "How many meals each week are outside your complete control?" },
    { id: "q113", n: 113, type: "single", label: 'Do you intentionally have a "cheat day"?', options: ["Yes", "No", "Sometimes"] },
    {
      id: "q114", n: 114, type: "textarea", label: "What does a cheat day normally look like for you?",
      showIf: (a) => is(a, "q113", "Yes") || is(a, "q113", "Sometimes"),
    },
  ],
};

// ---------------------------------------------------------------------------
// J — FOOD ENVIRONMENT & CULTURE (Q115–Q120)
// ---------------------------------------------------------------------------

const J: Section = {
  id: "environment",
  code: "J",
  title: "Food environment & culture",
  stage: "Diet",
  minutes: "3–4 min",
  questions: [
    { id: "q115", n: 115, tag: "planning", type: "text", label: "Which country and city do you currently live in?" },
    {
      id: "q116", n: 116, tag: "planning", type: "single", label: "Which regional food pattern best matches your household?",
      options: [
        "Punjabi", "North Indian", "South Indian", "Gujarati", "Rajasthani", "Bengali",
        "Maharashtrian", "Bihar/Jharkhand", "Kerala", "Tamil", "Andhra/Telangana",
        "Karnataka", "Kashmiri", "North-East Indian", "Mixed Indian", "International", "Other",
      ],
    },
    {
      id: "q117", n: 117, tag: "planning", type: "multi", label: "Household staple foods",
      options: ["Roti", "Rice", "Paratha", "Dosa", "Idli", "Upma", "Poha", "Appam", "Millet", "Bread", "Pasta", "Oats", "Other"],
    },
    { id: "q118", n: 118, type: "single", label: "Do you have access to Indian groceries?", options: ["Easily", "Limited", "No", "Not applicable"] },
    {
      id: "q119", n: 119, tag: "planning", type: "single",
      label: "Any cultural or religious food practices relevant to diet planning?",
      options: ["Yes", "No", "Prefer not to discuss"],
    },
    { id: "q119a", tag: "conditional", type: "textarea", label: "Practices — in the client's words", showIf: (a) => is(a, "q119", "Yes") },
    {
      id: "q120", n: 120, tag: "planning", type: "single", label: "Do you follow fasting practices?",
      options: ["Never", "Occasionally", "Weekly", "Monthly", "During specific periods"],
    },
  ],
};

// ---------------------------------------------------------------------------
// K — FOOD PREFERENCE (Q121–Q130)
// ---------------------------------------------------------------------------

const K: Section = {
  id: "preference",
  code: "K",
  title: "Food preference",
  stage: "Diet",
  minutes: "5–6 min",
  questions: [
    {
      id: "q121", n: 121, tag: "planning", type: "single", label: "Your food pattern is:",
      options: ["Vegetarian", "Vegan", "Eggetarian", "Non-vegetarian", "Pescatarian", "Other"],
    },
    { id: "q122", n: 122, tag: "planning", type: "textarea", label: "Five foods you love and want to continue eating" },
    { id: "q123", n: 123, tag: "planning", type: "textarea", label: "Five foods you would strongly prefer NOT to have in your diet" },
    {
      id: "q124", n: 124, tag: "clinical", type: "single", label: "Do you have any diagnosed food allergy?",
      options: YES_NO, note: "RED FLAG — record allergen and reaction; never include it in any form.",
    },
    {
      id: "q124a", tag: "conditional", type: "textarea", label: "Allergen(s) and the reaction",
      placeholder: "Peanuts — throat swelling, hospitalised 2023",
      showIf: (a) => is(a, "q124", "Yes"),
    },
    {
      id: "q125", n: 125, tag: "clinical", type: "multi", label: "Do you have any known food intolerance?",
      options: [
        "Lactose", "Gluten-related diagnosed condition", "Specific dairy foods",
        "Specific vegetables", "Other", "None",
      ],
    },
    { id: "q126", n: 126, type: "textarea", label: "Which foods commonly cause discomfort?" },
    { id: "q127", n: 127, type: "textarea", label: "Foods previous diet plans gave you that you disliked" },
    { id: "q128", n: 128, tag: "planning", type: "textarea", label: "Foods too expensive for you to consume regularly" },
    { id: "q129", n: 129, tag: "planning", type: "textarea", label: "Foods difficult to find where you live" },
    { id: "q130", n: 130, type: "textarea", label: "Foods you do not know how to prepare" },
  ],
};

// ---------------------------------------------------------------------------
// L — PROTEIN ASSESSMENT (Q131–Q142)
// ---------------------------------------------------------------------------

const L: Section = {
  id: "protein",
  code: "L",
  title: "Protein assessment",
  stage: "Diet",
  minutes: "5–6 min",
  questions: [
    { id: "q131", n: 131, tag: "fitness", type: "single", label: "How many meals per day contain a clear protein source?", options: ["None", "1", "2", "3", "4+"] },
    {
      id: "q132", n: 132, tag: "planning", type: "single", label: "Do you consume protein at breakfast?",
      options: ["Daily", "Frequently", "Sometimes", "Rarely", "Never", "Don't know"],
    },
    {
      id: "q133", n: 133, tag: "planning", type: "multi", label: "Which vegetarian proteins do you eat?",
      options: [
        "Paneer", "Tofu", "Soy chunks", "Tempeh", "Milk", "Curd", "Greek yogurt",
        "Dal", "Chickpeas", "Rajma/beans", "Peas", "Protein powder", "None", "Other",
      ],
    },
    {
      id: "q134", n: 134, type: "single", label: "How frequently do you eat paneer?",
      options: ["Daily", "4–6 times/week", "2–3 times/week", "Weekly", "Rarely", "Never"],
    },
    { id: "q135", n: 135, tag: "clinical", type: "single", label: "Can you comfortably digest dairy?", options: ["Yes", "Mostly", "Some dairy causes issues", "No", "Not sure"] },
    { id: "q136", n: 136, type: "single", label: "Do you eat eggs?", options: YES_NO },
    {
      id: "q137", n: 137, tag: "conditional", type: "text", label: "How many whole eggs / egg whites do you usually consume?",
      showIf: (a) => is(a, "q136", "Yes"),
    },
    {
      id: "q138", n: 138, type: "multi", label: "Which non-vegetarian proteins do you consume?",
      options: ["Chicken", "Fish", "Seafood", "Mutton", "Other meat", "None"],
      showIf: (a) => is(a, "q121", "Non-vegetarian") || is(a, "q121", "Pescatarian") || is(a, "q121", "Other"),
    },
    {
      id: "q139", n: 139, type: "single", label: "How frequently do you consume non-vegetarian food?",
      options: ["Daily", "4–6 times/week", "2–3 times/week", "Weekly", "Occasionally"],
      showIf: (a) => is(a, "q121", "Non-vegetarian") || is(a, "q121", "Pescatarian"),
    },
    { id: "q140", n: 140, tag: "planning", type: "single", label: "Would you be comfortable increasing protein intake?", options: ["Yes", "Maybe", "No", "Need easy options"] },
    {
      id: "q141", n: 141, tag: "planning", type: "multi", label: "What could make higher protein intake difficult?",
      options: [
        "Cost", "Cooking", "Digestion", "Taste", "Vegetarian diet", "Food availability",
        "Family preference", "Don't know what to eat", "Other",
      ],
    },
    {
      id: "q142", n: 142, tag: "planning", type: "single", label: "Comfortable using protein powder if assessed as appropriate?",
      options: ["Yes", "No", "Already using", "Need more information"],
    },
  ],
};

// ---------------------------------------------------------------------------
// M — TRAINING ASSESSMENT (Q143–Q157)
// ---------------------------------------------------------------------------

const M: Section = {
  id: "training",
  code: "M",
  title: "Training assessment",
  stage: "Fitness",
  minutes: "5–8 min",
  questions: [
    { id: "q143", n: 143, tag: "fitness", type: "single", label: "Are you currently exercising?", options: ["Yes", "No", "Starting with LeanR"] },
    {
      id: "q144", n: 144, tag: "fitness", type: "multi", label: "What exercise do you currently perform?",
      options: [
        "Strength training", "Gym machines", "Free weights", "Cardio", "Running",
        "Walking", "Cycling", "Swimming", "Yoga", "Pilates", "Sport", "Home workout", "Other",
      ],
      showIf: (a) => is(a, "q143", "Yes"),
    },
    { id: "q145", n: 145, tag: "fitness", type: "single", label: "How many days per week do you exercise?", options: ["0", "1–2", "3", "4", "5", "6–7"] },
    {
      id: "q146", n: 146, type: "single", label: "How long is an average workout?",
      options: ["Less than 30 min", "30–45 min", "45–60 min", "60–90 min", "More than 90 min"],
      showIf: (a) => !is(a, "q143", "No"),
    },
    {
      id: "q147", n: 147, tag: "planning", type: "single", label: "What time do you usually train?",
      options: ["Early morning", "Morning", "Afternoon", "Evening", "Late evening", "Variable"],
      showIf: (a) => !is(a, "q143", "No"),
    },
    {
      id: "q148", n: 148, tag: "fitness", type: "single", label: "How long have you been strength training?",
      options: ["Never", "Less than 3 months", "3–6 months", "6–12 months", "1–3 years", "More than 3 years"],
    },
    {
      id: "q149", n: 149, tag: "fitness", type: "single", label: "How would you describe your training level?",
      options: ["Complete beginner", "Beginner", "Intermediate", "Advanced", "Not sure"],
    },
    {
      id: "q150", n: 150, tag: "clinical", type: "multi", label: "During exercise, do you experience:",
      options: [
        "Weakness", "Dizziness", "Nausea", "Unusual breathlessness", "Chest discomfort",
        "Muscle cramps", "Headache", "None",
      ],
      note: "RED FLAG — chest discomfort, fainting or severe unexplained symptoms require escalation.",
    },
    { id: "q151", n: 151, tag: "fitness", type: "scale10", label: "How is your workout energy? (1–10)", showIf: (a) => !is(a, "q143", "No") },
    { id: "q152", n: 152, tag: "fitness", type: "single", label: "How is your recovery?", options: ["Excellent", "Good", "Average", "Poor", "Very poor"] },
    {
      id: "q153", n: 153, type: "single", label: "How long does muscle soreness usually last?",
      options: ["Less than 24 hours", "1–2 days", "3–4 days", "More than 4 days", "I don't experience soreness"],
    },
    { id: "q154", n: 154, tag: "fitness", type: "single", label: "Your strength is currently:", options: ["Increasing", "Stable", "Decreasing", "Don't track"] },
    { id: "q155", n: 155, type: "single", label: "Do you feel unusually exhausted after workouts?", options: FREQ },
    {
      id: "q156", n: 156, tag: "planning", type: "single", label: "How many steps do you average daily?",
      options: ["Less than 2,000", "2,000–5,000", "5,000–8,000", "8,000–10,000", "10,000+", "Don't know"],
    },
    {
      id: "q157", n: 157, tag: "planning", type: "single", label: "How many hours do you spend sitting daily?",
      options: ["Less than 4", "4–6", "6–8", "8–10", "More than 10"],
    },
  ],
};

// ---------------------------------------------------------------------------
// N — INJURY & PT HANDOVER (Q158–Q165)
// ---------------------------------------------------------------------------

const N: Section = {
  id: "injury",
  code: "N",
  title: "Injury & training setup",
  stage: "Fitness",
  minutes: "3–5 min",
  questions: [
    { id: "q158", n: 158, tag: "clinical", type: "single", label: "Do you currently have any pain or injury?", options: YES_NO },
    {
      id: "q159", n: 159, tag: "conditional", type: "multi", label: "Where is the pain?",
      options: ["Neck", "Shoulder", "Elbow", "Wrist", "Upper back", "Lower back", "Hip", "Knee", "Ankle", "Other"],
      showIf: (a) => is(a, "q158", "Yes"),
    },
    {
      id: "q160", n: 160, tag: "conditional", type: "single", label: "Has it been medically evaluated?",
      options: ["Yes", "No", "Evaluation planned"], showIf: (a) => is(a, "q158", "Yes"),
    },
    {
      id: "q161", n: 161, tag: "clinical", type: "single",
      label: "Has any movement been restricted by a doctor or physiotherapist?",
      options: YES_NO, showIf: (a) => is(a, "q158", "Yes"),
    },
    { id: "q162", n: 162, type: "single", label: "Are you afraid of any particular exercise?", options: YES_NO },
    { id: "q163", n: 163, tag: "fitness", type: "single", label: "Where will you train?", options: ["Gym", "Home", "Outdoor", "Mixed"] },
    {
      id: "q164", n: 164, tag: "fitness", type: "multi", label: "What equipment is available?",
      options: ["Dumbbells", "Resistance bands", "Barbell", "Machines", "Bench", "Treadmill", "Cycle", "No equipment", "Full gym", "Other"],
    },
    { id: "q165", n: 165, tag: "fitness", type: "single", label: "How many days can you realistically commit to training?", options: ["2", "3", "4", "5", "6"] },
  ],
};

// ---------------------------------------------------------------------------
// O — DAILY ROUTINE (Q166–Q174)
// ---------------------------------------------------------------------------

const O: Section = {
  id: "routine",
  code: "O",
  title: "Daily routine",
  stage: "Lifestyle",
  minutes: "4–6 min",
  questions: [
    {
      id: "q166", n: 166, tag: "planning", type: "single", label: "What best describes your occupation?",
      options: ["Desk job", "Active job", "Field job", "Business owner", "Homemaker", "Student", "Retired", "Other"],
    },
    { id: "q167", n: 167, type: "single", label: "Work arrangement?", options: ["Office", "Work from home", "Hybrid", "Travel-based", "Not applicable"] },
    { id: "q168", n: 168, tag: "planning", type: "text", label: "Work timing", placeholder: "e.g. 09:30 – 18:30" },
    { id: "q169", n: 169, tag: "planning", type: "single", label: "Do you work shifts?", options: ["Fixed day", "Fixed night", "Rotational", "No shift"] },
    { id: "q170", n: 170, tag: "planning", type: "textarea", label: "Describe your normal day from waking until sleeping" },
    {
      id: "q171", n: 171, tag: "planning", type: "single", label: "At what time is following a diet hardest?",
      options: ["Morning", "Afternoon", "Evening", "Night", "Weekends", "Variable"],
    },
    {
      id: "q172", n: 172, tag: "planning", type: "single", label: "Which meal do you have the least control over?",
      options: ["Breakfast", "Lunch", "Evening snack", "Dinner", "All", "None"],
    },
    { id: "q173", n: 173, type: "single", label: "Can you take meal breaks at work?", options: ["Easily", "Usually", "Sometimes", "Rarely", "No"] },
    { id: "q174", n: 174, tag: "planning", type: "single", label: "Can you carry food?", options: ["Yes", "Limited", "No"] },
  ],
};

// ---------------------------------------------------------------------------
// P — COOKING & FOOD ACCESS (Q175–Q180)
// ---------------------------------------------------------------------------

const P: Section = {
  id: "cooking",
  code: "P",
  title: "Cooking & food access",
  stage: "Lifestyle",
  minutes: "3–4 min",
  questions: [
    {
      id: "q175", n: 175, tag: "planning", type: "single", label: "Who usually cooks your food?",
      options: ["Self", "Spouse", "Parent", "Cook", "Hostel/PG", "Office", "Restaurant", "Delivery"],
    },
    { id: "q176", n: 176, tag: "planning", type: "single", label: "Do you have access to a kitchen?", options: ["Full kitchen", "Basic kitchen", "Microwave only", "No kitchen"] },
    { id: "q177", n: 177, type: "single", label: "Do you have refrigerator access?", options: YES_NO },
    {
      id: "q178", n: 178, tag: "planning", type: "single", label: "How much additional food preparation can you realistically do?",
      options: ["None", "Maximum 5 minutes", "10–15 minutes", "20–30 minutes", "Comfortable meal prepping"],
    },
    { id: "q179", n: 179, tag: "planning", type: "single", label: "Can you prepare food in advance?", options: ["Daily", "Twice weekly", "Weekly", "No"] },
    { id: "q180", n: 180, type: "scale10", label: "How comfortable are you with cooking? (1–10)" },
  ],
};

// ---------------------------------------------------------------------------
// Q — FOOD BUDGET (Q181–Q182)
// ---------------------------------------------------------------------------

const Q: Section = {
  id: "budget",
  code: "Q",
  title: "Food budget",
  stage: "Lifestyle",
  minutes: "2 min",
  questions: [
    {
      id: "q181", n: 181, tag: "planning", type: "single", label: "Which statement best describes your food planning preference?",
      options: [
        "Only regular household foods", "Mostly household foods",
        "Can add a few fitness foods", "Flexible", "Cost is not a major concern",
      ],
    },
    {
      id: "q182", n: 182, tag: "planning", type: "multi", label: "Which foods would be difficult to purchase regularly?",
      options: [
        "Paneer", "Tofu", "Greek yogurt", "Eggs", "Chicken", "Fish", "Nuts", "Seeds",
        "Protein powder", "Imported foods", "None", "Other",
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// R — HUNGER & SATIETY (Q183–Q188)
// ---------------------------------------------------------------------------

const R: Section = {
  id: "hunger",
  code: "R",
  title: "Hunger & satiety",
  stage: "Behaviour",
  minutes: "3–4 min",
  questions: [
    {
      id: "q183", n: 183, tag: "planning", type: "multi", label: "When are you most hungry?",
      options: ["Morning", "Before lunch", "Afternoon", "Evening", "After workout", "Late night", "Constantly hungry"],
    },
    { id: "q184", n: 184, type: "scale10", label: "Rate your usual hunger before meals (0–10)" },
    { id: "q185", n: 185, type: "single", label: "How quickly do you eat?", options: ["Less than 10 minutes", "10–15 minutes", "15–20 minutes", "More than 20 minutes"] },
    {
      id: "q186", n: 186, type: "single", label: "You normally stop eating when:",
      options: ["Slightly satisfied", "Comfortably full", "Very full", "Food is finished", "Others stop eating"],
    },
    { id: "q187", n: 187, type: "single", label: "Do you frequently feel hungry soon after eating?", options: ["Yes", "Sometimes", "No"] },
    { id: "q188", n: 188, tag: "planning", type: "textarea", label: "Which meals keep you full the longest?" },
  ],
};

// ---------------------------------------------------------------------------
// S — CRAVINGS & EATING BEHAVIOUR (Q189–Q196)
// ---------------------------------------------------------------------------

const S: Section = {
  id: "cravings",
  code: "S",
  title: "Cravings & eating behaviour",
  stage: "Behaviour",
  minutes: "4–5 min",
  questions: [
    {
      id: "q189", n: 189, type: "multi", label: "What do you crave most?",
      options: ["Sweet", "Chocolate", "Salty", "Fried food", "Fast food", "Bakery", "Tea/coffee", "Cold drinks", "No major craving"],
    },
    { id: "q190", n: 190, type: "single", label: "How often do cravings occur?", options: ["Multiple times daily", "Daily", "3–4 times/week", "Weekly", "Rarely"] },
    {
      id: "q191", n: 191, type: "multi", label: "What normally triggers your cravings?",
      options: [
        "Hunger", "Stress", "Boredom", "Anger", "Sadness", "Anxiety", "Work pressure",
        "Lack of sleep", "Menstrual cycle", "Social situation", "Habit", "Seeing food", "Other",
      ],
    },
    {
      id: "q192", n: 192, type: "multi", label: "On a stressful day, what happens to your eating?",
      options: ["Eat more", "Eat less", "Crave sweets", "Order food", "Skip meals", "No change"],
    },
    {
      id: "q193", n: 193, tag: "clinical", type: "single",
      label: "Do you ever feel that once you start eating, you cannot control how much you eat?",
      options: FREQ,
    },
    {
      id: "q194", n: 194, tag: "clinical", type: "single",
      label: "Do you ever eat a very large amount of food in a short period and feel distressed afterwards?",
      options: ["Frequently", "Sometimes", "Rarely", "Never", "Prefer not to answer"],
      note: "RED FLAG — assess possible disordered eating and refer appropriately. Do not intensify restriction.",
    },
    { id: "q195", n: 195, tag: "clinical", type: "single", label: "Do you intentionally skip meals to compensate after eating more?", options: FREQ },
    { id: "q196", n: 196, tag: "clinical", type: "single", label: "Do you feel intense guilt after eating certain foods?", options: FREQ },
  ],
};

// ---------------------------------------------------------------------------
// T — DIGESTION (Q197–Q205)
// ---------------------------------------------------------------------------

const T: Section = {
  id: "digestion",
  code: "T",
  title: "Digestion",
  stage: "Behaviour",
  minutes: "4–5 min",
  questions: [
    {
      id: "q197", n: 197, tag: "clinical", type: "multi", label: "Do you experience any digestive symptoms?",
      options: [
        "Bloating", "Gas", "Acidity", "Reflux", "Burping", "Abdominal pain",
        "Constipation", "Diarrhoea", "Nausea", "Early fullness", "None",
      ],
    },
    { id: "q198", n: 198, type: "single", label: "How often do you experience bloating?", options: ["Daily", "Most days", "Few times/week", "Occasionally", "Never"] },
    {
      id: "q199", n: 199, type: "multi", label: "When does bloating usually occur?",
      options: ["Morning", "After breakfast", "After lunch", "Evening", "After dinner", "After specific foods", "Random"],
      showIf: (a) => !is(a, "q198", "Never") && answered(a, "q198"),
    },
    {
      id: "q200", n: 200, type: "single", label: "How frequently do you pass stool?",
      options: ["More than 3 times/day", "1–3 times/day", "Once/day", "Every 2 days", "Less than 3 times/week"],
    },
    { id: "q201", n: 201, type: "single", label: "Do you strain during bowel movements?", options: FREQ },
    { id: "q202", n: 202, type: "single", label: "Do you feel incomplete evacuation?", options: FREQ },
    { id: "q203", n: 203, tag: "clinical", type: "single", label: "Have you noticed blood in stool?", options: YES_NO, note: "RED FLAG — medical evaluation." },
    {
      id: "q204", n: 204, tag: "clinical", type: "single",
      label: "Black or tar-like stool without a known medical explanation?",
      options: YES_NO, note: "RED FLAG",
    },
    { id: "q205", n: 205, tag: "clinical", type: "single", label: "Have your bowel habits changed significantly and persistently?", options: YES_NO },
  ],
};

// ---------------------------------------------------------------------------
// U — HYDRATION (Q206–Q210)
// ---------------------------------------------------------------------------

const U: Section = {
  id: "hydration",
  code: "U",
  title: "Hydration",
  stage: "Lifestyle",
  minutes: "2–3 min",
  questions: [
    {
      id: "q206", n: 206, tag: "planning", type: "single", label: "Approximately how much water do you drink daily?",
      options: ["Less than 1 litre", "1–1.5 L", "1.5–2 L", "2–3 L", "More than 3 L", "Don't track"],
    },
    { id: "q207", n: 207, type: "single", label: "Do you sweat heavily during workouts?", options: ["Yes", "Moderate", "Minimal", "Don't exercise"] },
    { id: "q208", n: 208, type: "single", label: "Do you exercise in a hot or humid environment?", options: ["Frequently", "Sometimes", "No"] },
    { id: "q209", n: 209, type: "single", label: "Do you use electrolytes?", options: ["Regularly", "Occasionally", "Never"] },
    {
      id: "q210", n: 210, tag: "clinical", type: "single", label: "Do you frequently experience excessive thirst?",
      options: YES_NO, probe: "Explore relevant medical context (glucose control).",
    },
  ],
};

// ---------------------------------------------------------------------------
// V — SLEEP (Q211–Q220)
// ---------------------------------------------------------------------------

const V: Section = {
  id: "sleep",
  code: "V",
  title: "Sleep",
  stage: "Lifestyle",
  minutes: "3–4 min",
  questions: [
    { id: "q211", n: 211, tag: "planning", type: "time", label: "What time do you usually sleep?" },
    { id: "q212", n: 212, tag: "planning", type: "time", label: "What time do you usually wake?" },
    {
      id: "q213", n: 213, tag: "planning", type: "single", label: "Average sleep duration",
      options: ["Less than 5 hours", "5–6 hours", "6–7 hours", "7–8 hours", "More than 8 hours"],
    },
    { id: "q214", n: 214, type: "scale10", label: "Rate your sleep quality (1–10)" },
    {
      id: "q215", n: 215, type: "single", label: "How long does it usually take you to fall asleep?",
      options: ["Less than 15 minutes", "15–30 minutes", "30–60 minutes", "More than 1 hour"],
    },
    { id: "q216", n: 216, type: "single", label: "Do you wake during the night?", options: FREQ },
    { id: "q217", n: 217, type: "single", label: "Do you wake feeling recovered?", options: ["Yes", "Sometimes", "No"] },
    { id: "q218", n: 218, tag: "clinical", type: "single", label: "Do you snore heavily?", options: ["Yes", "No", "Don't know"] },
    {
      id: "q219", n: 219, tag: "clinical", type: "single",
      label: "Has anyone noticed pauses in your breathing during sleep?",
      options: ["Yes", "No", "Don't know"],
      note: "RED FLAG — consider medical evaluation for sleep-disordered breathing.",
    },
    { id: "q220", n: 220, type: "single", label: "Do you feel excessively sleepy during the daytime?", options: FREQ },
  ],
};

// ---------------------------------------------------------------------------
// W — STRESS & RECOVERY (Q221–Q225)
// ---------------------------------------------------------------------------

const W: Section = {
  id: "stress",
  code: "W",
  title: "Stress & recovery",
  stage: "Lifestyle",
  minutes: "3–4 min",
  questions: [
    { id: "q221", n: 221, tag: "planning", type: "scale10", label: "Rate your current stress (1–10)" },
    {
      id: "q222", n: 222, type: "single", label: "Main stress source",
      options: ["Work", "Family", "Financial", "Relationship", "Health", "Study", "Multiple factors", "Other"],
    },
    { id: "q223", n: 223, type: "single", label: "Does stress affect your sleep?", options: ["Significantly", "Moderately", "Slightly", "No"] },
    {
      id: "q224", n: 224, type: "single", label: "Does stress affect your workouts?",
      options: ["I skip workouts", "Performance reduces", "I train more", "No impact", "Don't exercise"],
    },
    {
      id: "q225", n: 225, type: "single", label: "How much personal recovery time do you get daily?",
      options: ["None", "Less than 30 min", "30–60 min", "1–2 hours", "More than 2 hours"],
    },
  ],
};

// ---------------------------------------------------------------------------
// X — WOMEN'S HEALTH (Q226–Q235)
// ---------------------------------------------------------------------------

const X: Section = {
  id: "womens",
  code: "X",
  title: "Women's health",
  stage: "Clinical",
  minutes: "4–6 min",
  showIf: (a) => !is(a, "gender", "Male"),
  questions: [
    {
      id: "q226", n: 226, tag: "clinical", type: "single",
      label: "Are menstrual health questions relevant to your current health assessment?",
      options: ["Yes", "No", "Prefer not to discuss"],
    },
    {
      id: "q227", n: 227, type: "single", label: "Are your menstrual cycles generally regular?",
      options: ["Yes", "No", "Not currently menstruating"],
      showIf: (a) => is(a, "q226", "Yes"),
    },
    {
      id: "q228", n: 228, type: "single", label: "Average cycle length",
      options: ["Less than 21 days", "21–35 days", "More than 35 days", "Highly variable", "Don't know"],
      showIf: (a) => is(a, "q226", "Yes"),
    },
    { id: "q229", n: 229, type: "single", label: "Do you experience heavy bleeding?", options: YES_NO_UNSURE, showIf: (a) => is(a, "q226", "Yes") },
    { id: "q230", n: 230, type: "single", label: "Do you frequently miss periods?", options: YES_NO, showIf: (a) => is(a, "q226", "Yes") },
    {
      id: "q231", n: 231, tag: "clinical", type: "single", label: "Have you been diagnosed with PCOS/PCOD?",
      options: ["Yes", "No", "Under investigation"],
      showIf: (a) => is(a, "q226", "Yes"),
    },
    {
      id: "q232", n: 232, tag: "clinical", type: "single", label: "Are you currently pregnant?",
      options: ["Yes", "No", "Prefer not to answer"],
      note: "RED FLAG — no aggressive calorie deficit or standard fat-loss protocol.",
    },
    {
      id: "q233", n: 233, tag: "clinical", type: "single", label: "Are you breastfeeding?", options: YES_NO,
      note: "Avoid aggressive body transformation protocols.",
    },
    {
      id: "q234", n: 234, type: "single", label: "Are you in:",
      options: ["Perimenopause", "Menopause", "Post-menopause", "Not applicable", "Not sure"],
    },
    {
      id: "q235", n: 235, type: "single",
      label: "Body composition changes associated with hormonal life-stage changes?",
      options: YES_NO_UNSURE,
    },
  ],
};

// ---------------------------------------------------------------------------
// Y — ALCOHOL, SMOKING & CAFFEINE (Q236–Q241)
// ---------------------------------------------------------------------------

const Y: Section = {
  id: "substances",
  code: "Y",
  title: "Alcohol, smoking & caffeine",
  stage: "Lifestyle",
  minutes: "2–3 min",
  questions: [
    {
      id: "q236", n: 236, tag: "planning", type: "single", label: "How often do you consume alcohol?",
      options: ["Never", "Occasionally", "Monthly", "Weekly", "Multiple times/week", "Daily"],
    },
    {
      id: "q237", n: 237, tag: "conditional", type: "text", label: "Type and approximate amount",
      showIf: (a) => answered(a, "q236") && !is(a, "q236", "Never"),
    },
    {
      id: "q238", n: 238, tag: "conditional", type: "text", label: "What do you normally eat while drinking?",
      showIf: (a) => answered(a, "q236") && !is(a, "q236", "Never"),
    },
    { id: "q239", n: 239, type: "single", label: "Do you smoke, vape or use tobacco?", options: ["Never", "Former", "Current", "Prefer not to answer"] },
    { id: "q240", n: 240, type: "single", label: "How many caffeinated drinks do you consume daily?", options: ["0", "1", "2", "3", "4+"] },
    {
      id: "q241", n: 241, type: "single", label: "Latest caffeine timing",
      options: ["Before noon", "12–3 PM", "3–6 PM", "6–9 PM", "After 9 PM"],
    },
  ],
};

// ---------------------------------------------------------------------------
// Z — TRAVEL & SOCIAL (Q242–Q245)
// ---------------------------------------------------------------------------

const Z: Section = {
  id: "travel",
  code: "Z",
  title: "Travel & social life",
  stage: "Lifestyle",
  minutes: "2–3 min",
  questions: [
    {
      id: "q242", n: 242, tag: "planning", type: "single", label: "How frequently do you travel?",
      options: ["Rarely", "Monthly", "2–3 times/month", "Weekly", "Multiple times/week"],
    },
    {
      id: "q243", n: 243, type: "single", label: "Travel type", options: ["Domestic", "International", "Both"],
      showIf: (a) => answered(a, "q242") && !is(a, "q242", "Rarely"),
    },
    {
      id: "q244", n: 244, tag: "planning", type: "multi", label: "During travel, where do you normally eat?",
      options: ["Hotel", "Airport", "Restaurant", "Office/client meals", "Packed food", "Mixed"],
      showIf: (a) => answered(a, "q242") && !is(a, "q242", "Rarely"),
    },
    {
      id: "q245", n: 245, tag: "planning", type: "single", label: "How often do you attend social meals or family gatherings?",
      options: ["Multiple times/week", "Weekly", "2–3 times/month", "Monthly", "Rarely"],
    },
  ],
};

// ---------------------------------------------------------------------------
// AA — PREVIOUS DIET HISTORY (Q246–Q250)
// ---------------------------------------------------------------------------

const AA: Section = {
  id: "history",
  code: "AA",
  title: "Previous diet history",
  stage: "Behaviour",
  minutes: "3–4 min",
  questions: [
    { id: "q246", n: 246, type: "single", label: "Have you followed a structured diet before?", options: YES_NO },
    {
      id: "q247", n: 247, tag: "conditional", type: "multi", label: "Which approaches have you tried?",
      options: [
        "Calorie counting", "Keto", "Intermittent fasting", "Low carbohydrate",
        "Very low calorie", "High protein", "Detox", "Juice diet", "Meal replacement",
        "Dietitian plan", "Online plan", "Influencer diet", "Other",
      ],
      showIf: (a) => is(a, "q246", "Yes"),
    },
    { id: "q248", n: 248, type: "textarea", label: "Which approach gave you the best result?", showIf: (a) => is(a, "q246", "Yes") },
    {
      id: "q249", n: 249, tag: "planning", type: "multi", label: "Why did you stop following it?",
      options: [
        "Hunger", "Boredom", "Too restrictive", "Expensive", "Cooking difficulty",
        "Social life", "Travel", "No results", "Plateau", "Health issue",
        "Could not sustain", "Other",
      ],
      showIf: (a) => is(a, "q246", "Yes"),
    },
    { id: "q250", n: 250, tag: "planning", type: "textarea", label: "One diet experience you never want to repeat" },
  ],
};

// ---------------------------------------------------------------------------
// AB — ADHERENCE PERSONALITY (Q251–Q255)
// ---------------------------------------------------------------------------

const AB: Section = {
  id: "adherence",
  code: "AB",
  title: "Adherence personality",
  stage: "Behaviour",
  minutes: "3–4 min",
  questions: [
    {
      id: "q251", n: 251, tag: "planning", type: "multi", label: "When you receive a diet plan, which best describes you?",
      options: [
        "Follow exactly", "Follow most of it", "Need flexibility", "Get bored quickly",
        "Forget meals", "Schedule keeps changing", "Struggle on weekends",
        "Struggle during stress", "Travel affects adherence",
      ],
    },
    {
      id: "q252", n: 252, tag: "planning", type: "single", label: "How many meal options do you prefer?",
      options: ["One fixed meal", "Two options", "Three options", "Flexible exchange system"],
    },
    {
      id: "q253", n: 253, tag: "planning", type: "single", label: "How do you prefer portions?",
      options: ["Exact grams", "Cups/katoris", "Hand portions", "Simple visual guide", "Combination"],
    },
    { id: "q254", n: 254, type: "single", label: "Would you track your food?", options: ["Daily", "Few days/week", "Short-term only", "Prefer not to track"] },
    {
      id: "q255", n: 255, tag: "planning", type: "multi", label: "What type of diet support helps you most?",
      options: [
        "Detailed instructions", "Simple instructions", "Frequent accountability",
        "Flexible options", "Education and explanation", "Regular feedback",
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// AC — BARRIERS (Q256–Q259)
// ---------------------------------------------------------------------------

const BARRIERS = [
  "Time", "Work", "Travel", "Family", "Cooking", "Cravings", "Hunger", "Stress",
  "Sleep", "Social events", "Alcohol", "Motivation", "Gym consistency", "Injury",
  "Medical condition", "Budget", "Food availability", "Eating out", "Other",
];

const AC: Section = {
  id: "barriers",
  code: "AC",
  title: "Barriers",
  stage: "Behaviour",
  minutes: "4–6 min",
  questions: [
    { id: "q256", n: 256, tag: "planning", type: "multi", label: "What could stop you from achieving your goal?", options: BARRIERS },
    {
      id: "q257", n: 257, tag: "planning", type: "single", label: "Biggest barrier",
      options: BARRIERS, showIf: (a) => list(a, "q256").length > 0,
    },
    {
      id: "q258", n: 258, tag: "planning", type: "single", label: "Second biggest barrier",
      options: BARRIERS, showIf: (a) => list(a, "q256").length > 1,
    },
    {
      id: "q259", n: 259, tag: "planning", type: "single", label: "Third biggest barrier",
      options: BARRIERS, showIf: (a) => list(a, "q256").length > 2,
    },
  ],
};

// ---------------------------------------------------------------------------
// AD — NON-NEGOTIABLES & READINESS (Q260–Q266)
// ---------------------------------------------------------------------------

const AD: Section = {
  id: "nonnegotiables",
  code: "AD",
  title: "Non-negotiables & readiness",
  stage: "Behaviour",
  minutes: "3–4 min",
  questions: [
    {
      id: "q260", n: 260, tag: "planning", type: "multi",
      label: "What foods or habits are you NOT willing to completely remove?",
      options: [
        "Morning tea", "Coffee", "Rice", "Roti", "Paratha", "Family dinner",
        "Weekend meal", "Dessert", "Restaurant meal", "Cultural food", "Other",
      ],
      why: "These stay in the plan. The diet is built around them, not against them.",
    },
    {
      id: "q260a", tag: "planning", type: "single",
      label: "Do you avoid any foods on specific days of the week? (religious/cultural)",
      options: YES_NO,
      why: "e.g. no non-veg or eggs on Tuesday/Thursday — the plan makes those days fully compliant.",
    },
    {
      id: "q260b", tag: "conditional", type: "multi", label: "On which days?",
      options: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      showIf: (a) => is(a, "q260a", "Yes"),
    },
    {
      id: "q260c", tag: "conditional", type: "multi", label: "What do you avoid on those days?",
      options: [
        "Non-vegetarian food", "Eggs", "Onion & garlic", "All animal products",
        "Grains (fasting)", "Alcohol", "Other",
      ],
      showIf: (a) => is(a, "q260a", "Yes"),
    },
    {
      id: "q260d", tag: "conditional", type: "textarea",
      label: "Details (if it differs by day, spell it out)",
      placeholder: "e.g. No non-veg or eggs on Tuesday and Thursday; fasts on Ekadashi",
      showIf: (a) => is(a, "q260a", "Yes"),
    },
    { id: "q261", n: 261, tag: "planning", type: "textarea", label: "What are you completely willing to change?" },
    {
      id: "q262", n: 262, tag: "planning", type: "single",
      label: "How much change can you realistically manage in your first two weeks?",
      options: [
        "1–2 small changes", "3–4 structured changes", "Complete structured meal plan",
        "Intensive structured approach",
      ],
    },
    { id: "q263", n: 263, tag: "planning", type: "scale10", label: "How ready are you to make dietary changes? (1–10)" },
    {
      id: "q264", n: 264, tag: "conditional", type: "textarea", label: "What is stopping this number from being higher?",
      showIf: (a) => {
        const n = parseInt(val(a, "q263"), 10);
        return Number.isFinite(n) && n < 7;
      },
    },
    {
      id: "q265", n: 265, tag: "planning", type: "scale10",
      label: "If I design the diet around your existing routine, how confident are you that you can follow it? (1–10)",
    },
    {
      id: "q266", n: 266, tag: "conditional", type: "textarea",
      label: "What would increase your confidence by one or two points?",
      showIf: (a) => {
        const n = parseInt(val(a, "q265"), 10);
        return Number.isFinite(n) && n < 7;
      },
      note: "Address this barrier before finalising the first diet plan.",
    },
  ],
};

// ---------------------------------------------------------------------------
// PART 4 — CLINICAL BRANCHES (activated by Q41 / Q231 / Q232)
// ---------------------------------------------------------------------------

const hasCondition = (a: Answers, ...names: string[]) =>
  names.some((n) => has(a, "q41", n));

const BR_DIABETES: Section = {
  id: "br-diabetes",
  code: "BR",
  title: "Branch — Diabetes / prediabetes",
  stage: "Branches",
  showIf: (a) => hasCondition(a, "Diabetes", "Prediabetes", "Insulin resistance"),
  intro: "Do not independently alter diabetes medication. Escalate recurrent hypoglycaemia or uncontrolled glucose.",
  questions: [
    { id: "d1", tag: "clinical", type: "text", label: "Latest HbA1c (and date)" },
    { id: "d2", tag: "clinical", type: "text", label: "Latest fasting / post-meal glucose" },
    { id: "d3", tag: "clinical", type: "single", label: "Do you monitor glucose at home?", options: ["Yes", "No", "Sometimes"] },
    { id: "d4", tag: "clinical", type: "text", label: "When do you monitor?", showIf: (a) => !is(a, "d3", "No") && answered(a, "d3") },
    {
      id: "d5", tag: "clinical", type: "single",
      label: "Have you experienced shaking, sweating, confusion or significant weakness from low blood sugar?",
      options: FREQ,
      note: "RED FLAG if frequent — escalate before any calorie deficit.",
    },
    { id: "d6", tag: "clinical", type: "single", label: "Are you on insulin?", options: YES_NO },
    { id: "d7", tag: "clinical", type: "text", label: "Has your doctor provided a glucose target?" },
    { id: "d8", tag: "clinical", type: "single", label: "Has medication recently changed?", options: YES_NO },
    { id: "d9", tag: "planning", type: "textarea", label: "Carbohydrate pattern & meal timing (dietitian note)" },
    { id: "d10", tag: "planning", type: "single", label: "Sugary beverage intake", options: ["Daily", "Few times/week", "Occasionally", "Never"] },
    { id: "d11", tag: "clinical", type: "single", label: "Any exercise-related glucose symptoms?", options: YES_NO_UNSURE },
  ],
};

const BR_PCOS: Section = {
  id: "br-pcos",
  code: "BR",
  title: "Branch — PCOS / PCOD",
  stage: "Branches",
  showIf: (a) => hasCondition(a, "PCOS/PCOD") || is(a, "q231", "Yes"),
  intro: "Do not automatically prescribe a zero-carbohydrate diet.",
  questions: [
    { id: "p1", tag: "clinical", type: "text", label: "When and how was PCOS diagnosed?" },
    { id: "p2", tag: "clinical", type: "single", label: "Insulin resistance confirmed?", options: YES_NO_UNSURE },
    { id: "p3", tag: "clinical", type: "text", label: "Relevant glucose / lipid values" },
    { id: "p4", tag: "clinical", type: "textarea", label: "Medication for PCOS (e.g. metformin, OCP)" },
    { id: "p5", tag: "planning", type: "textarea", label: "Weight change pattern since diagnosis" },
    { id: "p6", tag: "planning", type: "textarea", label: "Previous diet attempts for PCOS and what happened" },
  ],
};

const BR_THYROID: Section = {
  id: "br-thyroid",
  code: "BR",
  title: "Branch — Thyroid",
  stage: "Branches",
  showIf: (a) => hasCondition(a, "Hypothyroidism", "Hyperthyroidism"),
  intro: "Do not modify thyroid medicine.",
  questions: [
    { id: "t1", tag: "clinical", type: "text", label: "Exact diagnosis" },
    { id: "t2", tag: "clinical", type: "text", label: "Medication and dose" },
    { id: "t3", tag: "clinical", type: "text", label: "Medication timing (relative to food)" },
    { id: "t4", tag: "clinical", type: "text", label: "Recent TSH (and date)" },
    { id: "t5", tag: "clinical", type: "single", label: "Recent medication change?", options: YES_NO },
    { id: "t6", tag: "clinical", type: "textarea", label: "Current symptoms and weight timeline" },
  ],
};

const BR_KIDNEY: Section = {
  id: "br-kidney",
  code: "BR",
  title: "Branch — Kidney (renal safety)",
  stage: "Branches",
  showIf: (a) => hasCondition(a, "Kidney disease", "Kidney stones"),
  intro:
    "RENAL SAFETY BRANCH. Do NOT implement a generic high-protein muscle gain diet. Medical coordination required.",
  questions: [
    { id: "k1", tag: "clinical", type: "text", label: "Diagnosis and stage (if known)" },
    { id: "k2", tag: "clinical", type: "single", label: "Nephrologist involved?", options: ["Yes", "No", "Follow-up pending"] },
    { id: "k3", tag: "clinical", type: "text", label: "Kidney function reports (creatinine, eGFR, urea)" },
    { id: "k4", tag: "clinical", type: "single", label: "Dialysis?", options: YES_NO },
    { id: "k5", tag: "clinical", type: "textarea", label: "Fluid restriction prescribed by doctor" },
    { id: "k6", tag: "clinical", type: "textarea", label: "Electrolyte restriction (potassium, phosphorus, sodium)" },
    { id: "k7", tag: "clinical", type: "textarea", label: "Protein restriction prescribed by doctor" },
  ],
};

const BR_LIVER: Section = {
  id: "br-liver",
  code: "BR",
  title: "Branch — Liver",
  stage: "Branches",
  showIf: (a) => hasCondition(a, "Fatty liver", "Other liver condition"),
  questions: [
    { id: "l1", tag: "clinical", type: "text", label: "Exact diagnosis" },
    { id: "l2", tag: "clinical", type: "text", label: "Fatty liver grade (if documented)" },
    { id: "l3", tag: "clinical", type: "text", label: "Liver reports (SGPT/SGOT, etc.)" },
    { id: "l4", tag: "clinical", type: "textarea", label: "Alcohol pattern" },
    { id: "l5", tag: "clinical", type: "textarea", label: "Medication and doctor recommendations" },
  ],
};

const BR_GOUT: Section = {
  id: "br-gout",
  code: "BR",
  title: "Branch — Gout / high uric acid",
  stage: "Branches",
  showIf: (a) => hasCondition(a, "Gout", "High uric acid"),
  intro: "Avoid generic food fear lists without complete assessment.",
  questions: [
    { id: "g1", tag: "clinical", type: "text", label: "Diagnosis" },
    { id: "g2", tag: "clinical", type: "single", label: "Flare frequency", options: ["Never", "Rare", "Few times/year", "Monthly", "Frequent"] },
    { id: "g3", tag: "clinical", type: "text", label: "Medication" },
    { id: "g4", tag: "clinical", type: "text", label: "Uric acid reports" },
    { id: "g5", tag: "planning", type: "textarea", label: "Alcohol, hydration and current dietary pattern" },
  ],
};

const BR_MUSCLE_GAIN: Section = {
  id: "br-muscle",
  code: "BR",
  title: "Branch — Muscle gain",
  stage: "Branches",
  showIf: (a) =>
    is(a, "q4", "I mainly want to gain muscle") ||
    is(a, "q4", "I want to lose fat and gain muscle") ||
    has(a, "q2", "Gain muscle"),
  questions: [
    { id: "m1", tag: "fitness", type: "text", label: "How long have you been actively trying to gain muscle?" },
    { id: "m2", tag: "fitness", type: "single", label: "Is your body weight increasing?", options: ["Yes", "No", "Fluctuating"] },
    { id: "m3", tag: "fitness", type: "text", label: "How much has weight changed in three months?" },
    { id: "m4", tag: "fitness", type: "single", label: "Is your strength progressing?", options: ["Yes", "No", "Slowly", "Don't track"] },
    { id: "m5", tag: "fitness", type: "single", label: "Do you struggle with appetite?", options: YES_NO },
    { id: "m6", tag: "fitness", type: "single", label: "Do you skip meals?", options: FREQ },
    { id: "m7", tag: "fitness", type: "single", label: "How many protein-containing meals do you consume?", options: ["None", "1", "2", "3", "4+"] },
    { id: "m8", tag: "planning", type: "single", label: "Are you willing to increase meal volume?", options: ["Yes", "Maybe", "No"] },
    { id: "m9", tag: "clinical", type: "single", label: "Do large meals cause digestive discomfort?", options: YES_NO_UNSURE },
    { id: "m10", tag: "fitness", type: "single", label: "Have you previously used mass gainers?", options: YES_NO },
  ],
};

// ---------------------------------------------------------------------------
// PART 6/7/8/9 — DIETITIAN ASSESSMENT, PT HANDOVER, PLAN DECISION, PRIORITIES
// ---------------------------------------------------------------------------

const SUMMARY: Section = {
  id: "assessment",
  code: "Part 6",
  title: "Dietitian assessment",
  stage: "Assessment",
  minutes: "3–5 min",
  intro: "Your clinical judgement — this is what the plan is actually built from.",
  questions: [
    {
      id: "s_objective", tag: "planning", type: "single", label: "Body composition objective",
      options: [
        "Fat Loss", "Muscle Preservation", "Body Recomposition", "Muscle Gain",
        "Healthy Weight Gain", "Performance", "General Fitness",
      ],
    },
    { id: "s_primary", tag: "planning", type: "text", label: "Primary goal (in your words)" },
    { id: "s_secondary", type: "text", label: "Secondary goal" },
    { id: "s_timeline", type: "text", label: "Target timeline" },
    { id: "s_restrictions", tag: "clinical", type: "textarea", label: "Clinical restrictions to respect in the plan" },
    { id: "s_doctor", tag: "clinical", type: "single", label: "Doctor coordination required?", options: YES_NO },
    {
      id: "s_gaps", tag: "planning", type: "multi", label: "Major nutrition gaps",
      options: [
        "Low Protein", "Poor Protein Distribution", "Long Meal Gaps", "Low Food Quality",
        "High Liquid Calories", "Excessive Restaurant Food", "Low Fruit/Vegetable Variety",
        "Poor Hydration", "Poor Workout Nutrition", "Restrictive Eating Pattern", "Other",
      ],
    },
    { id: "s_blocking", tag: "planning", type: "textarea", label: "What is currently stopping this client from reaching their goal?" },
    { id: "s_p1", tag: "planning", type: "text", label: "Nutrition priority 1" },
    { id: "s_p2", tag: "planning", type: "text", label: "Nutrition priority 2" },
    { id: "s_p3", tag: "planning", type: "text", label: "Nutrition priority 3" },
  ],
};

const PLAN: Section = {
  id: "plan",
  code: "Part 8",
  title: "Plan decision matrix",
  stage: "Assessment",
  minutes: "3–5 min",
  intro: "Meal frequency and structure are a clinical decision — never a universal rule.",
  questions: [
    {
      id: "pl_structure", tag: "planning", type: "single", label: "Primary diet structure",
      options: [
        "Structured Meal Plan", "Flexible Meal Option Plan", "Food Exchange/Choice System",
        "Habit-First Plan", "Macro-Guided Plan",
      ],
      why: "Predictable routine → structured. Changing schedule → flexible. Eats out often → exchange. Low readiness → habit-first.",
    },
    { id: "pl_protein", tag: "planning", type: "textarea", label: "Protein strategy (sources, distribution, breakfast, post-workout, supplement)" },
    { id: "pl_carb", tag: "planning", type: "textarea", label: "Carbohydrate strategy (sources, workout carbs, portion method)", note: "Do not remove rice or roti automatically." },
    { id: "pl_fat", tag: "planning", type: "textarea", label: "Fat strategy (cooking modification, portions)" },
    {
      id: "pl_meals", tag: "planning", type: "single", label: "Meal timing structure",
      options: [
        "3 meals", "3 meals + snack", "4 meals", "5 smaller meals",
        "Shift-based structure", "Training-based structure",
      ],
    },
    { id: "pl_meals_why", type: "text", label: "Reason for this meal structure" },
    { id: "pl_priority1", tag: "planning", type: "textarea", label: "14-day priority 1 — problem → change → how they'll implement it → how success is measured" },
    { id: "pl_priority2", tag: "planning", type: "textarea", label: "14-day priority 2" },
    { id: "pl_priority3", tag: "planning", type: "textarea", label: "14-day priority 3" },
    { id: "pl_notes", type: "textarea", label: "Anything else the AI must know when building the plan" },
  ],
};

const PT: Section = {
  id: "pt",
  code: "Part 7",
  title: "PT handover",
  stage: "Assessment",
  minutes: "2–3 min",
  intro: "Shared transformation goal: the PT trains for the physical objective, you fuel it.",
  questions: [
    { id: "pt_goal", tag: "fitness", type: "text", label: "Client's main transformation objective (for the PT)" },
    { id: "pt_observe", tag: "fitness", type: "textarea", label: "Please specifically observe…" },
    {
      id: "pt_coord", tag: "fitness", type: "multi", label: "Nutrition–training coordination required for",
      options: [
        "Workout timing", "Pre-workout meal", "Post-workout meal", "Low energy",
        "Muscle gain", "Fat loss", "Recovery", "Hydration", "Medical consideration",
      ],
    },
    { id: "pt_concern", type: "textarea", label: "Major nutrition concern affecting training" },
  ],
};

// ---------------------------------------------------------------------------

export const SECTIONS: Section[] = [
  CLIENT, A, B, C,
  D, E, F, G, X,
  BR_DIABETES, BR_PCOS, BR_THYROID, BR_KIDNEY, BR_LIVER, BR_GOUT, BR_MUSCLE_GAIN,
  H, I, J, K, L,
  M, N,
  O, P, Q, U, V, W, Y, Z,
  R, S, T, AA, AB, AC, AD,
  SUMMARY, PLAN, PT,
];

export const STAGES: Stage[] = [
  "Client", "Goals", "Clinical", "Branches", "Diet", "Fitness", "Lifestyle", "Behaviour", "Assessment",
];

/** Sections currently visible for these answers (branches activate as they are triggered). */
export function visibleSections(a: Answers): Section[] {
  return SECTIONS.filter((s) => !s.showIf || s.showIf(a));
}

/** Questions currently visible inside a section. */
export function visibleQuestions(section: Section, a: Answers): Question[] {
  return section.questions.filter((q) => !q.showIf || q.showIf(a));
}

// ---------------------------------------------------------------------------
// MANDATORY QUESTIONS — the ~5-6 per section that a diet plan cannot safely be
// built without. A required question only blocks generation while it is
// visible (hidden conditionals and inactive branches don't count).
// ---------------------------------------------------------------------------

const REQUIRED_IDS = new Set<string>([
  // Client details
  "name", "gender", "phone",
  // A — Welcome & expectations
  "q1", "q2", "q3", "q4", "q6", "q6a", "q9",
  // B — Body & weight journey
  "q11", "q12", "q13", "q16", "q22", "q30",
  // C — Body composition
  "q31", "q37", "q38", "q39",
  // D — Medical screening
  "q41", "q46", "q49", "q50", "q53", "q55",
  // E — Medication
  "q56", "q57", "q60",
  // F — Supplements
  "q61", "q62", "q67",
  // G — Blood reports
  "q68", "q71", "q72",
  // X — Women's health
  "q226", "q231", "q232", "q233",
  // Clinical / fitness branches
  "d1", "d3", "d5", "d6", "p2", "t2", "t3", "k1", "k2", "k4", "l1", "g2", "m5", "m8",
  // H — 24-hour diet recall
  "q79", "q80", "q89", "q90", "q102", "q103",
  // I — Weekly food pattern
  "q108", "q109", "q112",
  // J — Food environment & culture
  "q115", "q116", "q117", "q119", "q120",
  // K — Food preference
  "q121", "q122", "q123", "q124", "q124a", "q125",
  // L — Protein assessment
  "q131", "q132", "q133", "q135", "q136", "q140",
  // M — Training assessment
  "q143", "q145", "q148", "q150", "q156", "q157",
  // N — Injury & training setup
  "q158", "q163", "q164", "q165",
  // O — Daily routine
  "q166", "q168", "q169", "q171", "q172", "q174",
  // P — Cooking & food access
  "q175", "q176", "q178", "q179",
  // Q — Food budget
  "q181", "q182",
  // R — Hunger & satiety
  "q183", "q185", "q186",
  // S — Cravings & eating behaviour
  "q189", "q190", "q191", "q192", "q194",
  // T — Digestion
  "q197", "q200", "q203", "q204", "q205",
  // U — Hydration
  "q206", "q207",
  // V — Sleep
  "q211", "q212", "q213", "q214", "q218", "q219",
  // W — Stress & recovery
  "q221", "q222", "q223",
  // Y — Alcohol, smoking & caffeine
  "q236", "q239", "q240",
  // Z — Travel & social life
  "q242", "q245",
  // AA — Previous diet history
  "q246", "q247", "q249",
  // AB — Adherence personality
  "q251", "q252", "q253", "q255",
  // AC — Barriers
  "q256", "q257",
  // AD — Non-negotiables & readiness
  "q260", "q260a", "q260b", "q260c", "q261", "q262", "q263", "q265",
  // Dietitian assessment
  "s_objective", "s_restrictions", "s_gaps", "s_blocking", "s_p1",
  // Plan decision matrix
  "pl_structure", "pl_protein", "pl_carb", "pl_meals", "pl_priority1",
  // PT handover
  "pt_goal",
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

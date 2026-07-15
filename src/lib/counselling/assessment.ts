// ---------------------------------------------------------------------------
// Reads the LeanR Premium counselling answers back out: safety red flags, the
// 100-point counselling quality audit, and the two projections we need
// downstream — the legacy IntakeForm (clients table + follow-ups) and the rich
// clinical profile the AI independently analyses (per the LeanR Premium spec,
// the dietitian's Section 11 answers are a professional hypothesis the AI must
// test against the complete client profile).
// ---------------------------------------------------------------------------

import type { DietType, IntakeForm } from "../types";
import { emptyIntake } from "../types";
import {
  answered,
  has,
  hasAny,
  hasOther,
  is,
  list,
  MEAL_OCCASIONS,
  val,
  type Answers,
} from "./questions";

// ---------------------------------------------------------------------------
// RED FLAGS — clinical stops. "escalate" ones mean the plan should not be
// finalised until a medical professional / senior dietitian has been involved.
// ---------------------------------------------------------------------------

export interface RedFlag {
  id: string;
  label: string;
  action: string;
  escalate: boolean;
}

// Q21 symptoms that always require medical escalation before any plan.
const URGENT_SYMPTOMS = [
  "Chest pain or pressure",
  "Fainting",
  "Severe breathlessness",
  "Breathlessness during light activity",
  "Irregular or very rapid heartbeat sensation",
  "Repeated vomiting",
  "Blood in stool",
  "Black or tarry stool",
  "Unexplained rapid weight loss",
];

const REDS_SIGNS = [
  "Stress fracture or bone injury",
  "Menstrual cycle irregular or stopped",
  "Training while eating very little",
  "Fear of increasing food despite high training",
];

const ED_RISK = [
  "Feeling unable to control eating",
  "Eating an unusually large amount with distress",
  "Self-induced vomiting",
  "Other compensatory behaviour",
  "Professionally diagnosed eating disorder",
];

const RULES: { when: (a: Answers) => boolean; flag: Omit<RedFlag, "id"> }[] = [
  ...URGENT_SYMPTOMS.map((symptom) => ({
    when: (a: Answers) => has(a, "q21", symptom),
    flag: {
      label: symptom,
      action: "Medical evaluation required before finalising the plan. Follow the safety SOP.",
      escalate: true,
    },
  })),
  {
    when: (a) => is(a, "q21c", "Urgent SOP escalation"),
    flag: { label: "Dietitian marked urgent SOP escalation", action: "Escalate immediately per SOP.", escalate: true },
  },
  {
    when: (a) => has(a, "q25a", "Blood") || has(a, "q25a", "Black or tarry"),
    flag: { label: "Blood / black tarry stool", action: "Medical evaluation required.", escalate: true },
  },
  {
    when: (a) => hasOther(a, "q27", ["No known allergy"]),
    flag: {
      label: "Known food allergy",
      action: "Allergen must never appear in any meal, in any form or preparation.",
      escalate: false,
    },
  },
  {
    when: (a) =>
      hasOther(a, "q27", ["No known allergy"]) &&
      (is(a, "q27a", "Severe") || is(a, "q27a", "Previous emergency reaction")),
    flag: {
      label: "Severe / emergency food allergy",
      action: "Zero tolerance: no allergen or cross-reactive food anywhere. Senior review of the plan.",
      escalate: true,
    },
  },
  {
    when: (a) => hasAny(a, "q60", ED_RISK),
    flag: {
      label: "Possible disordered-eating pattern",
      action:
        "Do NOT intensify restriction. Keep structure permissive; refer to an appropriately qualified professional.",
      escalate: true,
    },
  },
  {
    when: (a) =>
      is(a, "q60a", "Senior clinical review required") ||
      is(a, "q60a", "Professional referral should be considered"),
    flag: {
      label: "Eating-behaviour review flagged by dietitian",
      action: "Senior clinical review / professional referral before intensifying the plan.",
      escalate: true,
    },
  },
  {
    when: (a) => has(a, "q66", "Pregnant"),
    flag: {
      label: "Pregnant",
      action: "No calorie deficit or standard fat-loss protocol. Coordinate with treating clinician.",
      escalate: true,
    },
  },
  {
    when: (a) => has(a, "q66", "Breastfeeding"),
    flag: { label: "Breastfeeding", action: "Avoid aggressive transformation protocols.", escalate: false },
  },
  {
    when: (a) => has(a, "q17", "Kidney condition"),
    flag: {
      label: "Kidney condition",
      action: "No generic high-protein plan. Protein/fluid/electrolytes per nephrologist.",
      escalate: true,
    },
  },
  {
    when: (a) => has(a, "q17", "Liver condition"),
    flag: { label: "Liver condition", action: "Clinical nutrition modification required.", escalate: false },
  },
  {
    when: (a) => has(a, "q17", "Professionally diagnosed eating disorder"),
    flag: {
      label: "Diagnosed eating disorder",
      action: "Plan only alongside the treating professional. No restriction-led approach.",
      escalate: true,
    },
  },
  {
    when: (a) => has(a, "q18", "Bariatric surgery"),
    flag: {
      label: "Bariatric surgery history",
      action: "Post-bariatric clinical nutrition strategy required — senior review.",
      escalate: true,
    },
  },
  {
    when: (a) => hasOther(a, "q22", ["No instruction"]),
    flag: {
      label: "Doctor-given food/exercise instruction",
      action: "The healthcare professional's instruction overrides plan design.",
      escalate: false,
    },
  },
  {
    when: (a) => hasAny(a, "q52", REDS_SIGNS),
    flag: {
      label: "Possible under-fuelling (RED-S signs)",
      action: "No deficit until reviewed. Prioritise fuelling, recovery and senior/medical review.",
      escalate: true,
    },
  },
  {
    when: (a) => is(a, "q13", "Yes"),
    flag: {
      label: "Rapid-loss / highly restrictive diet history",
      action: "Consider intake stabilisation before any deficit; avoid re-triggering restriction.",
      escalate: false,
    },
  },
  {
    when: (a) => is(a, "q17a", "Uncontrolled"),
    flag: {
      label: "Condition currently uncontrolled",
      action: "Coordinate with the treating doctor before transformation-focused planning.",
      escalate: false,
    },
  },
  {
    when: (a) => has(a, "q61c", "Observed breathing pauses"),
    flag: {
      label: "Breathing pauses during sleep",
      action: "Consider evaluation for sleep-disordered breathing.",
      escalate: false,
    },
  },
  {
    when: (a) =>
      has(a, "cr1", "Doctor clearance should be considered") ||
      has(a, "cr1", "Senior Dietitian review required"),
    flag: {
      label: "Clinical reflection: clearance / senior review",
      action: "Obtain doctor clearance or senior dietitian review before finalising.",
      escalate: true,
    },
  },
];

export function redFlags(a: Answers): RedFlag[] {
  return RULES.filter((r) => r.when(a)).map((r, i) => ({ id: `rf${i}`, ...r.flag }));
}

// ---------------------------------------------------------------------------
// Counselling quality audit (100 points). Points are earned for information
// actually captured, so the score doubles as live progress.
// ---------------------------------------------------------------------------

export interface AuditCategory {
  name: string;
  earned: number;
  max: number;
  missing: string[];
}

type Item = { points: number; label: string; done: (a: Answers) => boolean };

const all = (...ids: string[]) => (a: Answers) => ids.every((id) => answered(a, id));

/** Every selected meal occasion has its food detail filled. */
const mealDetailComplete = (a: Answers) => {
  const chosen = MEAL_OCCASIONS.filter((o) => has(a, "q28", o.label));
  return chosen.length > 0 && chosen.every((o) => answered(a, `q28_${o.key}_food`));
};

const RUBRIC: { name: string; items: Item[] }[] = [
  {
    name: "Goal & motivation",
    items: [
      { points: 3, label: "Main result", done: all("q2") },
      { points: 2, label: "Decision trigger", done: all("q1") },
      { points: 2, label: "Deeper motivation", done: all("q4") },
      { points: 1, label: "Deadline", done: all("q7") },
      { points: 2, label: "Goal reflection", done: all("gr_dietitian", "gr_client") },
    ],
  },
  {
    name: "Body & history",
    items: [
      { points: 3, label: "Anthropometrics", done: all("q9_age", "q9_height", "q9_weight") },
      { points: 2, label: "Recent change", done: all("q10") },
      { points: 2, label: "Diet history", done: all("q12") },
      { points: 2, label: "Regain / plateau", done: all("q13", "q14") },
    ],
  },
  {
    name: "Clinical safety",
    items: [
      { points: 4, label: "Medical conditions", done: all("q17") },
      { points: 3, label: "Medicines", done: (a) => is(a, "q19", "No") || all("q19", "q19a")(a) },
      { points: 3, label: "Blood reports", done: all("q20") },
      { points: 3, label: "Symptom screen", done: all("q21") },
      { points: 2, label: "Medical instructions", done: all("q22") },
    ],
  },
  {
    name: "Digestion & tolerance",
    items: [
      { points: 2, label: "Digestion & symptoms", done: all("q23", "q24") },
      { points: 2, label: "Bowel pattern", done: all("q25", "q25a") },
      { points: 2, label: "Allergy screen", done: all("q27") },
    ],
  },
  {
    name: "Actual food day",
    items: [
      { points: 3, label: "Meal occasions", done: all("q28") },
      { points: 3, label: "Meal timeline detail", done: mealDetailComplete },
      { points: 2, label: "Typicality", done: all("q29") },
      { points: 2, label: "Weekend pattern", done: all("q30") },
      { points: 2, label: "Outside food", done: all("q31") },
      { points: 2, label: "Smaller foods & drinks", done: all("q32") },
    ],
  },
  {
    name: "Preferences & feasibility",
    items: [
      { points: 2, label: "Food pattern", done: all("q33") },
      { points: 1, label: "Cuisines", done: all("q34") },
      { points: 2, label: "Favourite foods", done: all("q35") },
      { points: 1, label: "Dislikes", done: all("q36") },
      { points: 2, label: "Non-negotiables", done: all("q37") },
      { points: 1, label: "Restrictions", done: all("q38") },
      { points: 1, label: "Who cooks / control", done: all("q39", "q39a") },
      { points: 1, label: "Prep capacity", done: all("q41") },
      { points: 1, label: "Budget", done: all("q42") },
    ],
  },
  {
    name: "Training & protein",
    items: [
      { points: 2, label: "Current training", done: all("q43") },
      { points: 2, label: "Experience & goal", done: all("q44d", "q44f") },
      { points: 2, label: "Protein sources", done: all("q50") },
      { points: 2, label: "Protein meals/day", done: all("q50a") },
      { points: 1, label: "Supplements", done: all("q51") },
      { points: 1, label: "Under-fuelling screen", done: all("q52") },
    ],
  },
  {
    name: "Routine & behaviour",
    items: [
      { points: 2, label: "Work & activity", done: all("q54", "q54c") },
      { points: 2, label: "Hardest food situations", done: all("q55") },
      { points: 1, label: "Hunger pattern", done: all("q56") },
      { points: 1, label: "Cravings", done: all("q58") },
      { points: 1, label: "Stress eating", done: all("q59") },
      { points: 1, label: "Eating-pattern screen", done: all("q60") },
    ],
  },
  {
    name: "Lifestyle",
    items: [
      { points: 2, label: "Sleep", done: all("q61", "q61a") },
      { points: 1, label: "Stress", done: all("q62") },
      { points: 1, label: "Fluids", done: all("q63") },
      { points: 1, label: "Caffeine", done: all("q64") },
      { points: 1, label: "Alcohol / tobacco", done: all("q65") },
    ],
  },
  {
    name: "Success & coaching",
    items: [
      { points: 1, label: "Dropout trigger", done: all("q68") },
      { points: 1, label: "Off-plan behaviour", done: all("q69") },
      { points: 1, label: "Support style", done: all("q70") },
      { points: 1, label: "Beliefs", done: all("q71") },
      { points: 1, label: "Structure preference", done: all("q72") },
      { points: 1, label: "Top barriers", done: all("q73") },
    ],
  },
  {
    name: "Dietitian strategy & discussion",
    items: [
      { points: 1, label: "Limiting factors", done: all("q76") },
      { points: 1, label: "Minimum changes", done: all("q77") },
      { points: 1, label: "Energy strategy & priorities", done: all("q89", "q91") },
      { points: 1, label: "Client discussion", done: all("q102", "q105") },
    ],
  },
];

export interface AuditResult {
  score: number;
  band: "Excellent" | "Good" | "Incomplete" | "Review required";
  categories: AuditCategory[];
}

export function audit(a: Answers): AuditResult {
  const categories = RUBRIC.map((cat) => {
    let earned = 0;
    const missing: string[] = [];
    for (const item of cat.items) {
      if (item.done(a)) earned += item.points;
      else missing.push(item.label);
    }
    return {
      name: cat.name,
      earned,
      max: cat.items.reduce((s, i) => s + i.points, 0),
      missing,
    };
  });

  const score = categories.reduce((s, c) => s + c.earned, 0);
  const band: AuditResult["band"] =
    score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 60 ? "Incomplete" : "Review required";

  return { score, band, categories };
}

// ---------------------------------------------------------------------------
// Legacy projection — the clients table columns and follow-up plans still speak
// IntakeForm, so every counselling maps onto it. The full answers ride along in
// `intake.answers` and are what the AI actually plans from.
// ---------------------------------------------------------------------------

const DIET_TYPE: Record<string, DietType> = {
  Vegetarian: "vegetarian",
  Eggetarian: "eggetarian",
  Vegan: "vegan",
  "Non-vegetarian": "non-vegetarian",
  Pescatarian: "non-vegetarian",
  Flexitarian: "non-vegetarian",
  Jain: "vegetarian",
};

const joinList = (a: Answers, id: string, drop: string[] = []) =>
  list(a, id).filter((v) => !drop.includes(v)).join(", ");

export interface ClinicalIntake extends IntakeForm {
  /** Every answer, keyed by question id. */
  answers: Answers;
  /** Appointment this counselling was started from, if any. */
  appointmentId?: string | null;
}

/** Allergens the plan must never contain (q27 selections + "Other" detail). */
export function allergenList(a: Answers): string[] {
  const chosen = list(a, "q27").filter((v) => v !== "No known allergy" && v !== "Other");
  const other = val(a, "q27c").trim();
  return other ? [...chosen, other] : chosen;
}

export function toIntake(a: Answers, appointmentId?: string | null): ClinicalIntake {
  const conditions = list(a, "q17").filter((c) => c !== "No known condition");
  if (has(a, "q66", "PCOS or PCOD") && !conditions.includes("PCOS or PCOD"))
    conditions.push("PCOS or PCOD");
  if (has(a, "q66", "Pregnant")) conditions.push("Pregnant");
  if (has(a, "q66", "Breastfeeding")) conditions.push("Breastfeeding");

  const intolerances = [
    joinList(a, "q26", ["No repeated discomfort", "Other"]),
    val(a, "q26c").trim(),
  ]
    .filter(Boolean)
    .join(", ");

  const exercise = [
    joinList(a, "q43", ["Currently not exercising"]),
    val(a, "q44a") ? `${val(a, "q44a")} days/week` : "",
    val(a, "q44c") ? `usually ${val(a, "q44c").toLowerCase()}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  const tobacco = joinList(a, "q65", ["Alcohol", "None", "Prefer not to answer"]);

  return {
    ...emptyIntake,
    fullName: val(a, "name").trim(),
    age: val(a, "q9_age"),
    gender: val(a, "gender"),
    heightCm: val(a, "q9_height"),
    weightKg: val(a, "q9_weight"),
    targetWeightKg: val(a, "q5_weight") || val(a, "q82a"),
    phone: val(a, "phone"),
    email: val(a, "email"),
    occupation: val(a, "q54"),
    goal: val(a, "q80") || val(a, "q2"),

    dietType: DIET_TYPE[val(a, "q33")] ?? "vegetarian",
    cuisines: joinList(a, "q34"),
    mealsPerDay: String(list(a, "q28").length || ""),
    likes: val(a, "q35"),
    dislikes: val(a, "q36"),
    allergies: allergenList(a).join(", "),
    intolerances,
    cookingTime: joinList(a, "q41"),

    activityLevel: [val(a, "q54c"), val(a, "q54d") ? `~${val(a, "q54d")} steps/day` : ""]
      .filter(Boolean)
      .join(", "),
    exercise,
    sleepHours: val(a, "q61"),
    wakeTime: val(a, "q28_wake_time") || val(a, "q28_breakfast_time"),
    bedTime: val(a, "q28_beforesleep_time"),
    waterIntakeLitres: val(a, "q63"),
    smoking: tobacco || (has(a, "q65", "None") ? "No" : ""),
    alcohol: has(a, "q65", "Alcohol") ? val(a, "q65a") || "Yes" : "No",
    eatingOutPerWeek: val(a, "q31"),
    workSchedule: [val(a, "q54"), val(a, "q54a"), val(a, "q54b")].filter(Boolean).join(" · "),

    conditions,
    medications: val(a, "q19a"),
    supplements: joinList(a, "q51", ["None"]),
    digestion: joinList(a, "q24", ["None"]),
    labNotes: [val(a, "q20a"), val(a, "q20b")].filter(Boolean).join(" — "),

    notes: [val(a, "q78"), weeklyDayRulesText(a)].filter(Boolean).join("\n"),
    answers: a,
    appointmentId: appointmentId ?? null,
  };
}

/**
 * "On Tuesday, Thursday avoids: Non-vegetarian food, Eggs — <details>".
 * Empty string when the client has no day-specific food rules (q38a–c).
 */
export function weeklyDayRulesText(a: Answers): string {
  const days = list(a, "q38a");
  const avoided = list(a, "q38b");
  const details = val(a, "q38c").trim();
  if (!days.length && !details) return "";
  const parts: string[] = [];
  if (days.length && avoided.length) parts.push(`On ${days.join(", ")} avoids: ${avoided.join(", ")}`);
  if (details) parts.push(details);
  return parts.join(" — ");
}

// ---------------------------------------------------------------------------
// Clinical profile for the AI — the complete client picture the LeanR Premium
// spec requires the AI to independently analyse. Only blocks with content are
// emitted, so the prompt stays tight for a light counselling and rich for a
// full one.
// ---------------------------------------------------------------------------

type Block = Record<string, unknown>;

const clean = (o: Block): Block | null => {
  const out: Block = {};
  for (const [k, v] of Object.entries(o)) {
    if (v == null) continue;
    if (typeof v === "string" && !v.trim()) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : null;
};

/** The interactive meal timeline as structured objects. */
function mealTimeline(a: Answers): Block[] {
  const meals: Block[] = [];
  for (const { key, label } of MEAL_OCCASIONS) {
    if (!has(a, "q28", label)) continue;
    meals.push(
      clean({
        occasion: label,
        time: val(a, `q28_${key}_time`),
        food_and_quantity: val(a, `q28_${key}_food`),
        preparation: list(a, `q28_${key}_prep`),
        source: val(a, `q28_${key}_source`),
        added_components: list(a, `q28_${key}_extras`).filter((v) => v !== "None"),
      }) ?? { occasion: label }
    );
  }
  return meals;
}

export function aiProfile(a: Answers): Block {
  const flags = redFlags(a);

  const profile: Block = {};
  const put = (key: string, block: Block | null) => {
    if (block) profile[key] = block;
  };

  put("goal", clean({
    decision_triggers: list(a, "q1"),
    main_result: val(a, "q2"),
    other_results: list(a, "q3"),
    why_it_matters: list(a, "q4"),
    targets: list(a, "q5").filter((v) => v !== "No specific numerical target"),
    target_weight_kg: val(a, "q5_weight"),
    target_bodyfat_pct: val(a, "q5_bodyfat"),
    target_waist: val(a, "q5_waist"),
    target_inch_loss: val(a, "q5_inches"),
    target_clothing_size: val(a, "q5_size"),
    other_targets: val(a, "q5_other"),
    physique_result: list(a, "q6"),
    deadline: val(a, "q7") === "No deadline" ? null : val(a, "q7"),
    deadline_date: val(a, "q7a"),
    deadline_importance: val(a, "q7b"),
    readiness_1_10: val(a, "q8"),
    readiness_barriers: list(a, "q8a"),
    goal_reflection_dietitian: val(a, "gr_dietitian"),
    goal_reflection_client: val(a, "gr_client"),
  }));

  put("body_history", clean({
    age: val(a, "q9_age"),
    gender: val(a, "gender"),
    height_cm: val(a, "q9_height"),
    weight_kg: val(a, "q9_weight"),
    weight_one_year_ago_kg: val(a, "q9_weight_1y"),
    highest_adult_weight_kg: val(a, "q9_weight_high"),
    lowest_adult_weight_kg: val(a, "q9_weight_low"),
    previous_comfortable_weight_kg: val(a, "q9_weight_comfort"),
    recent_change: list(a, "q10"),
    change_amount_kg: val(a, "q10a"),
    change_period: val(a, "q10b"),
    contributors: list(a, "q11"),
    previous_approaches: list(a, "q12"),
    previous_result: val(a, "q12a"),
    why_difficult: list(a, "q12b"),
    rapid_or_restrictive_diet: val(a, "q13"),
    rapid_loss_kg: val(a, "q13a"),
    rapid_loss_period: val(a, "q13b"),
    rapid_loss_consequences: list(a, "q13c"),
    regain_or_plateau: list(a, "q14").filter((v) => v !== "No"),
    plateau_duration: val(a, "q14a"),
    body_composition_data: list(a, "q15").filter((v) => v !== "No data"),
    body_fat_pct: val(a, "q15_bf"),
    muscle_mass_kg: val(a, "q15_muscle"),
    skeletal_muscle_mass_kg: val(a, "q15_smm"),
    visceral_fat: val(a, "q15_visceral"),
    waist: val(a, "q15_waist"),
    hip: val(a, "q15_hip"),
    chest: val(a, "q15_chest"),
    arm: val(a, "q15_arm"),
    thigh: val(a, "q15_thigh"),
    measurement_source: val(a, "q15_src"),
    measurement_reliability: val(a, "q15_assess"),
    success_pattern_factors: list(a, "q16"),
    top_success_factors_ranked: val(a, "q16a"),
  }));

  put("clinical", clean({
    conditions: list(a, "q17").filter((c) => c !== "No known condition"),
    condition_status: val(a, "q17a"),
    doctor_follow_up: val(a, "q17b"),
    condition_notes: val(a, "q17c"),
    medical_events: list(a, "q18").filter((v) => v !== "None"),
    event_impact: list(a, "q18a").filter((v) => v !== "No current impact"),
    medicines: val(a, "q19") === "Yes" ? val(a, "q19a") : "none",
    recent_medicine_change: val(a, "q19b") === "No" ? null : val(a, "q19b"),
    blood_reports_available: list(a, "q20").filter((v) => v !== "No recent reports"),
    report_status: val(a, "q20a"),
    abnormal_values: val(a, "q20b"),
    symptoms: list(a, "q21").filter((v) => v !== "None"),
    symptom_frequency: val(a, "q21a"),
    symptom_doctor_assessed: val(a, "q21b"),
    safety_status: val(a, "q21c"),
    professional_instructions: list(a, "q22").filter((v) => v !== "No instruction"),
    instruction_details: val(a, "q22a"),
    dietitian_clinical_reflection: list(a, "cr1"),
  }));

  put("digestion", clean({
    overall: val(a, "q23"),
    symptoms: list(a, "q24").filter((v) => v !== "None"),
    symptom_frequency: val(a, "q24a"),
    symptom_timing: list(a, "q24b"),
    severity_1_10: val(a, "q24c"),
    bowel_frequency: val(a, "q25"),
    stool_experience: list(a, "q25a").filter((v) => v !== "Comfortable and formed"),
    discomfort_foods: list(a, "q26").filter((v) => v !== "No repeated discomfort"),
    discomfort_reaction: list(a, "q26a"),
    discomfort_pattern: val(a, "q26b"),
    other_trigger_foods: val(a, "q26c"),
  }));

  if (flags.length) {
    profile.red_flags = flags.map((f) => `${f.label} — ${f.action}`);
  }

  put("food_rules", clean({
    diet_pattern: val(a, "q33"),
    country: val(a, "q34a"),
    city: val(a, "q34b"),
    household_cuisines: list(a, "q34"),
    household_staples: list(a, "q34c"),
    allergies_never_include: allergenList(a),
    allergy_severity: val(a, "q27a"),
    intolerances_avoid: list(a, "q26").filter((v) => !["No repeated discomfort", "Other"].includes(v)),
    dislikes: val(a, "q36"),
    dislike_strength: val(a, "q36a"),
    favourites_protect: val(a, "q35"),
    non_negotiables_keep_in_plan: list(a, "q37").filter((v) => v !== "No strong non-negotiable"),
    cultural_or_religious_restrictions: list(a, "q38").filter((v) => v !== "No restriction"),
    weekly_day_specific_exclusions: weeklyDayRulesText(a),
    who_cooks: list(a, "q39"),
    food_preparation_control: val(a, "q39a"),
    kitchen_facilities: list(a, "q40"),
    meal_prep_capacity: list(a, "q41"),
    budget: val(a, "q42"),
    limited_access_to: list(a, "q42a").filter((v) => v !== "No major limitation"),
  }));

  put("current_food_day", clean({
    meal_timeline: mealTimeline(a),
    how_typical: val(a, "q29"),
    weekend_changes: list(a, "q30").filter((v) => v !== "No major change"),
    outside_food_frequency: val(a, "q31"),
    outside_food_sources: list(a, "q31a"),
    common_outside_orders: val(a, "q31b"),
    hidden_intake_items: list(a, "q32").filter((v) => v !== "Nothing significant"),
    hidden_intake_detail: val(a, "q32a"),
  }));

  put("training", clean({
    current_training: list(a, "q43"),
    days_per_week: val(a, "q44a"),
    session_duration: val(a, "q44b"),
    training_time: val(a, "q44c"),
    training_location: val(a, "q44g"),
    experience: val(a, "q44d"),
    intensity: val(a, "q44e"),
    primary_training_goal: val(a, "q44f"),
    feel_during_training: list(a, "q45").filter((v) => v !== "No major problem"),
    recovery_between_sessions: list(a, "q46"),
    pre_workout: list(a, "q47"),
    pre_workout_timing: val(a, "q47a"),
    during_workout: list(a, "q48").filter((v) => v !== "Nothing"),
    post_workout: list(a, "q49"),
    post_workout_timing: val(a, "q49a"),
    pain_or_injury: list(a, "q53").filter((v) => v !== "No limitation"),
    injury_assessed_by: val(a, "q53a"),
    pt_handover: val(a, "q53b"),
  }));

  put("protein_and_supplements", clean({
    protein_sources: list(a, "q50"),
    meals_with_clear_protein: val(a, "q50a"),
    protein_barriers: list(a, "q50b").filter((v) => v !== "No major barrier"),
    supplements: list(a, "q51").filter((v) => v !== "None"),
    supplements_recommended_by: val(a, "q51a"),
    supplement_side_effects: list(a, "q51b").filter((v) => v !== "None"),
    supplement_details: val(a, "q51c"),
    under_fuelling_signs: list(a, "q52").filter((v) => v !== "None"),
    under_fuelling_coincided_with: list(a, "q52a"),
  }));

  put("routine_and_behaviour", clean({
    work_type: val(a, "q54"),
    shift: val(a, "q54a"),
    meal_breaks: val(a, "q54b"),
    daily_activity: val(a, "q54c"),
    average_steps: val(a, "q54d"),
    commute: val(a, "q54e"),
    hardest_food_situations: list(a, "q55").filter((v) => v !== "No specific time"),
    hardest_reasons: list(a, "q55a"),
    hunger_pattern: val(a, "q56"),
    appetite: list(a, "q57").filter((v) => v !== "No concern"),
    cravings: list(a, "q58").filter((v) => v !== "No strong cravings"),
    craving_triggers: list(a, "q58a"),
    craving_time: val(a, "q58b"),
    stress_eating: list(a, "q59").filter((v) => v !== "No major effect"),
    eating_pattern_risk: list(a, "q60").filter((v) => v !== "None"),
    eating_risk_safety_selection: val(a, "q60a"),
  }));

  put("lifestyle", clean({
    sleep_duration: val(a, "q61"),
    sleep_quality_1_10: val(a, "q61a"),
    wake_refreshed: val(a, "q61b"),
    sleep_concerns: list(a, "q61c").filter((v) => v !== "No major concern"),
    stress_1_10: val(a, "q62"),
    stress_sources: list(a, "q62a"),
    stress_affects: list(a, "q62b").filter((v) => v !== "No noticeable effect"),
    fluid_intake: val(a, "q63"),
    higher_fluid_demand: list(a, "q63a").filter((v) => v !== "None"),
    electrolytes: val(a, "q63b"),
    caffeine_products: list(a, "q64").filter((v) => v !== "None"),
    caffeine_servings_per_day: val(a, "q64a"),
    last_caffeine: val(a, "q64b"),
    caffeine_sugar_added: val(a, "q64c"),
    alcohol_nicotine_tobacco: list(a, "q65").filter((v) => !["None", "Prefer not to answer"].includes(v)),
    alcohol_tobacco_frequency: val(a, "q65a"),
    alcohol_tobacco_situation: list(a, "q65b"),
    hormonal_reproductive: list(a, "q66").filter(
      (v) => !["Nothing relevant", "Not applicable", "Prefer not to answer"].includes(v)
    ),
    hormonal_medical_care: val(a, "q66a"),
    travel_social_situations: list(a, "q67").filter((v) => v !== "Rarely affected"),
    travel_social_effect: list(a, "q67a"),
    travel_social_frequency: val(a, "q67b"),
  }));

  put("success_dropout_coaching", clean({
    dropout_first_signs: list(a, "q68"),
    after_off_plan: list(a, "q69"),
    support_that_helps: list(a, "q70"),
    nutrition_beliefs: list(a, "q71").filter((v) => v !== "No strong belief affecting choices"),
    belief_restriction_level: val(a, "q71a"),
    diet_structure_preference: val(a, "q72"),
    portion_explanation_preference: val(a, "q72a"),
    top_barriers_ranked: list(a, "q73").filter((v) => v !== "No major barrier"),
    realistic_change_first_2_weeks: val(a, "q74"),
    confidence_1_10: val(a, "q75"),
    what_would_make_it_easier: list(a, "q75a"),
  }));

  // The dietitian's professional hypothesis (Section 11) — the AI must
  // independently test this, not blindly obey it. Hard constraints (ds2) are
  // the exception: they are non-negotiable rules, not part of the hypothesis.
  put("dietitian_hypothesis", clean({
    case_understanding: val(a, "ds1"),
    ai_hard_constraints: val(a, "ds2"),
    foods_ai_must_not_force: val(a, "ds3"),
    special_instruction_to_ai: val(a, "ds4"),
    limiting_factors_ranked: list(a, "q76"),
    minimum_changes: list(a, "q77"),
    foods_habits_to_protect: val(a, "q78"),
    restriction_risk: list(a, "q79").filter((v) => v !== "No unnecessary restriction identified"),
    transformation_objective: val(a, "q80"),
    transformation_phase: val(a, "q81"),
    initial_weight_target_kg: val(a, "q82a"),
    long_term_weight_target_kg: val(a, "q82b"),
    client_target_assessment: val(a, "q82c"),
    target_reasons: list(a, "q83"),
    target_confidence: val(a, "q83a"),
    body_composition_direction: val(a, "q84"),
    body_fat_target: val(a, "q84a"),
    muscle_direction: val(a, "q84b"),
    visceral_fat_direction: val(a, "q84c"),
    measurement_targets: list(a, "q85").filter((v) => v !== "No measurement target"),
    measurement_target_values: val(a, "q85a"),
    performance_objectives: list(a, "q86").filter((v) => v !== "No specific performance target"),
    initial_strategy_period: val(a, "q87a"),
    first_reassessment: val(a, "q87b"),
    initial_target_timeline: val(a, "q87c"),
    long_term_period: val(a, "q87d"),
    timeline_assessment: val(a, "q87e"),
    success_markers_ranked: list(a, "q88"),
    energy_strategy: val(a, "q89"),
    muscle_priority: val(a, "q90"),
    performance_priority: val(a, "q90a"),
    nutrition_priorities_ranked: list(a, "q91"),
    protein_assessment: val(a, "q92"),
    protein_gap: list(a, "q92a").filter((v) => v !== "No major gap"),
    protein_direction: list(a, "q92b"),
    supplement_opinion: val(a, "q92c"),
    carbohydrate_strategy: list(a, "q93"),
    fat_strategy: list(a, "q94"),
    fibre_digestive_strategy: list(a, "q95"),
    hydration_strategy: list(a, "q96"),
    workout_recovery_strategy: list(a, "q97").filter((v) => v !== "No specific modification"),
    pt_coordination: list(a, "q98").filter((v) => v !== "No coordination required"),
    pt_coordination_priority: val(a, "q98a"),
    education_areas: list(a, "q99").filter((v) => v !== "No significant issue"),
    education_approach: val(a, "q99a"),
    diet_structure: val(a, "q100"),
    lifestyle_fit_score_1_10: val(a, "q101"),
    fit_concern: val(a, "q101a"),
  }));

  put("client_discussion", clean({
    understands_limiting_factors: val(a, "q102"),
    finds_direction_realistic: val(a, "q103"),
    main_concern: val(a, "q103a"),
    direction_modified_after_discussion: list(a, "q104").filter((v) => v !== "No"),
    final_confidence_1_10: val(a, "q105"),
    important_information_not_discussed: val(a, "q74a"),
  }));

  return profile;
}

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
import { estimateProteinIntake, proteinTarget, stapleQuestionId } from "../protein-intake";

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

// ---------------------------------------------------------------------------
// Clinical matching.
//
// These rules are the app's safety stops, and they compared answers with
// exact, case-sensitive string equality. Rewording a single option in the
// question bank therefore switched a rule off silently — moving to the v3.0
// wording alone would have killed 8 of the 9 urgent-symptom flags ("Chest pain
// or pressure" became "Chest Pain") and INVERTED the doctor-instruction flag,
// firing it for every client who reported no restrictions.
//
// So clinical matching is now case-insensitive and every rule carries the
// wordings it must recognise, v3.0 first and the earlier bank's kept as
// aliases — clients counselled before the rewrite still have the old strings
// stored, and their flags must not quietly stop working.
// ---------------------------------------------------------------------------

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Strips the "none" answers from a multi-select before it reaches the AI.
 * Both wordings must be listed — v3.0 renamed most of them, and an
 * unrecognised none-option is passed to the model as a real finding
 * ("No Medical Condition" arriving in the conditions list).
 */
const dropNone = (values: string[], none: string[]): string[] => {
  const skip = new Set(none.map(norm));
  return values.filter((v) => !skip.has(norm(v)));
};


/** Multi-select containing any of `options`, case-insensitively. */
const hasAnyOf = (a: Answers, id: string, options: string[]): boolean => {
  const want = new Set(options.map(norm));
  return list(a, id).some((v) => want.has(norm(v)));
};

/** Single-select equal to any of `options`, case-insensitively. */
const isOneOf = (a: Answers, id: string, options: string[]): boolean => {
  const v = norm(val(a, id));
  return v !== "" && options.some((o) => norm(o) === v);
};

/**
 * Multi-select answered with anything beyond the given "none" options.
 * Every wording of the none-option must be listed: an unrecognised one is read
 * as a real answer, which is how "No Restrictions" came to raise a
 * doctor-instruction flag.
 */
const hasBeyond = (a: Answers, id: string, none: string[]): boolean => {
  const skip = new Set(none.map(norm));
  return list(a, id).some((v) => !skip.has(norm(v)));
};

// Q21 symptoms that always require medical escalation before any plan.
// v3.0 wording first, pre-v3.0 aliases after.
const URGENT_SYMPTOMS = [
  "Chest Pain", "Chest pain or pressure",
  "Fainting",
  "Breathlessness", "Severe breathlessness", "Breathlessness during light activity",
  "Palpitations", "Irregular or very rapid heartbeat sensation",
  "Repeated Vomiting", "Repeated vomiting",
  "Blood in Stool", "Blood in stool",
  "Black Stool", "Black or tarry stool",
  "Rapid Unexplained Weight Loss", "Unexplained rapid weight loss",
  // v3.0 additions that belong on an urgent list on their own merits.
  "Swelling in Legs",
  "Severe Headache During Exercise",
];

// Under-fuelling / RED-S. q52 has no v3.0 Section 1 equivalent, so the question
// is carried over from the previous bank rather than lost — these are the signs
// that stop a deficit being prescribed at all.
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
    when: (a: Answers) => hasAnyOf(a, "q21", [symptom]),
    flag: {
      label: symptom,
      action: "Medical evaluation required before finalising the plan. Follow the safety SOP.",
      escalate: true,
    },
  })),
  {
    when: (a) => isOneOf(a, "q21c", ["SOP Escalation Required", "Urgent SOP escalation"]),
    flag: { label: "Dietitian marked urgent SOP escalation", action: "Escalate immediately per SOP.", escalate: true },
  },
  {
    // Blood/black stool is caught on Q19 symptoms. The retired stool-consistency
    // question (q25a) is still checked so the flag keeps firing for the
    // counsellings that were recorded while it existed.
    when: (a) =>
      hasAnyOf(a, "q25a", ["Blood", "Black or tarry"]) ||
      hasAnyOf(a, "q21", ["Blood in Stool", "Black Stool"]),
    flag: { label: "Blood / black tarry stool", action: "Medical evaluation required.", escalate: true },
  },
  {
    when: (a) => hasBeyond(a, "q27", ["No known allergy", "No Known Allergy", "None"]),
    flag: {
      label: "Known food allergy",
      action: "Allergen must never appear in any meal, in any form or preparation.",
      escalate: false,
    },
  },
  {
    when: (a) =>
      hasBeyond(a, "q27", ["No known allergy", "No Known Allergy", "None"]) &&
      isOneOf(a, "q27a", ["Severe", "Previous emergency reaction", "Anaphylaxis"]),
    flag: {
      label: "Severe / emergency food allergy",
      action: "Zero tolerance: no allergen or cross-reactive food anywhere. Senior review of the plan.",
      escalate: true,
    },
  },
  {
    when: (a) => hasAnyOf(a, "q60", ED_RISK),
    flag: {
      label: "Possible disordered-eating pattern",
      action:
        "Do NOT intensify restriction. Keep structure permissive; refer to an appropriately qualified professional.",
      escalate: true,
    },
  },
  {
    when: (a) =>
      isOneOf(a, "q60a", [
        "Senior Clinical Review", "Senior clinical review required",
        "Mental Health Professional Referral", "Professional referral should be considered",
      ]),
    flag: {
      label: "Eating-behaviour review flagged by dietitian",
      action: "Senior clinical review / professional referral before intensifying the plan.",
      escalate: true,
    },
  },
  {
    when: (a) => hasAnyOf(a, "q66", ["Pregnant"]),
    flag: {
      label: "Pregnant",
      action: "No calorie deficit or standard fat-loss protocol. Coordinate with treating clinician.",
      escalate: true,
    },
  },
  {
    when: (a) => hasAnyOf(a, "q66", ["Breastfeeding"]),
    flag: { label: "Breastfeeding", action: "Avoid aggressive transformation protocols.", escalate: false },
  },
  {
    // Kept separate from the RED-S flag below: amenorrhoea is a low-energy
    // signal often enough to stop a deficit, but PCOS and several other causes
    // produce it too, and labelling every one of them "under-fuelling" would
    // send the dietitian down the wrong road.
    when: (a) => isOneOf(a, "q66_cycle", ["No period for 3+ months"]),
    flag: {
      label: "No period for 3+ months",
      action:
        "Medical review before any deficit — bone health and energy availability are the question, whatever the cause turns out to be.",
      escalate: true,
    },
  },
  {
    // Only chronic kidney disease suppresses a high-protein plan; v3.0's
    // separate "Kidney Stones" and "High Uric Acid" entries must not.
    when: (a) => hasAnyOf(a, "q17", ["Chronic Kidney Disease", "Kidney condition"]),
    flag: {
      label: "Kidney condition",
      action: "No generic high-protein plan. Protein/fluid/electrolytes per nephrologist.",
      escalate: true,
    },
  },
  {
    when: (a) =>
      hasAnyOf(a, "q17", [
        "Other Liver Disease", "Hepatitis", "Fatty Liver Grade I", "Fatty Liver Grade II",
        "Fatty Liver Grade III", "Liver condition",
      ]),
    flag: { label: "Liver condition", action: "Clinical nutrition modification required.", escalate: false },
  },
  {
    // v3.0's Q14 condition list has no eating-disorder entry; the diagnosis is
    // captured at q60 instead, so read both.
    when: (a) =>
      hasAnyOf(a, "q17", ["Professionally diagnosed eating disorder"]) ||
      hasAnyOf(a, "q60", ["Professionally diagnosed eating disorder"]),
    flag: {
      label: "Diagnosed eating disorder",
      action: "Plan only alongside the treating professional. No restriction-led approach.",
      escalate: true,
    },
  },
  {
    when: (a) => hasAnyOf(a, "q18", ["Bariatric Surgery", "Bariatric surgery"]),
    flag: {
      label: "Bariatric surgery history",
      action: "Post-bariatric clinical nutrition strategy required — senior review.",
      escalate: true,
    },
  },
  {
    // Every wording of the none-option must be listed here: an unrecognised
    // one reads as a real restriction and flags every healthy client.
    when: (a) => hasBeyond(a, "q22", ["No Restrictions", "No instruction", "None"]),
    flag: {
      label: "Doctor-given food/exercise instruction",
      action: "The healthcare professional's instruction overrides plan design.",
      escalate: false,
    },
  },
  {
    when: (a) => hasAnyOf(a, "q52", REDS_SIGNS),
    flag: {
      label: "Possible under-fuelling (RED-S signs)",
      action: "No deficit until reviewed. Prioritise fuelling, recovery and senior/medical review.",
      escalate: true,
    },
  },
  {
    when: (a) => isOneOf(a, "q13", ["Yes"]),
    flag: {
      label: "Rapid-loss / highly restrictive diet history",
      action: "Consider intake stabilisation before any deficit; avoid re-triggering restriction.",
      escalate: false,
    },
  },
  {
    when: (a) => isOneOf(a, "q17a", ["Uncontrolled"]),
    flag: {
      label: "Condition currently uncontrolled",
      action: "Coordinate with the treating doctor before transformation-focused planning.",
      escalate: false,
    },
  },
  {
    when: (a) => hasAnyOf(a, "q61c", ["Observed breathing pauses", "Breathing Pauses"]),
    flag: {
      label: "Breathing pauses during sleep",
      action: "Consider evaluation for sleep-disordered breathing.",
      escalate: false,
    },
  },
  {
    when: (a) =>
      hasAnyOf(a, "cr1", [
        "Doctor clearance should be considered", "Senior Dietitian review required",
      ]) ||
      // v3.0 records the same decision on Q19's dietitian safety call.
      isOneOf(a, "q21c", ["Doctor Clearance Recommended", "Clinical Dietitian Review"]),
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
export const mealDetailComplete = (a: Answers) => {
  const chosen = MEAL_OCCASIONS.filter((o) => has(a, "q28", o.label));
  // Either input completes an occasion: tapped staples record the same meal
  // the free text would have, and holding a tap-only consultation "incomplete"
  // would push dietitians back to typing for no gain.
  return (
    chosen.length > 0 &&
    chosen.every(
      (o) => answered(a, `q28_${o.key}_food`) || answered(a, stapleQuestionId(o.key))
    )
  );
};

const RUBRIC: { name: string; items: Item[] }[] = [
  {
    name: "Goal & motivation",
    items: [
      { points: 3, label: "Main result", done: all("q2") },
      { points: 2, label: "Decision trigger", done: all("q1") },
      { points: 2, label: "Deeper motivation", done: all("q4") },
      // The old 1-point "Deadline" item (q7) went with the question itself —
      // its point moved here rather than being dropped, so the rubric still
      // totals 100 and the score keeps meaning the same thing.
      { points: 3, label: "Goal reflection", done: all("gr_dietitian", "gr_client") },
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
      { points: 2, label: "Bowel pattern", done: all("q25") },
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
    name: "Dietitian strategy",
    items: [
      // The client-discussion point went with that section; it now scores the
      // dietitian's own read of the case, which is what the trimmed assessment
      // section actually asks for. q91 (nutrition priorities) went the same way
      // — the energy strategy is what that point was really scoring.
      { points: 1, label: "Case understanding", done: all("ds1") },
      { points: 1, label: "Limiting factors", done: all("q76") },
      { points: 1, label: "Minimum changes", done: all("q77") },
      { points: 1, label: "Energy strategy", done: all("q89") },
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

/**
 * Best available daily-steps figure. Steps live only in the activity/NEAT
 * section now (they used to be re-asked as a number in the baseline section):
 * prefer the exact weekday count (q112), fall back to the band (q106).
 */
const stepsLabel = (a: Answers): string => {
  const weekday = val(a, "q112");
  if (weekday) return `~${weekday} steps/day`;
  const band = val(a, "q106");
  return band && band !== "Don't Know" ? `${band} steps/day` : "";
};

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
  const conditions = dropNone(list(a, "q17"), ["No Medical Condition", "No known condition"]);
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
    // q82a (the dietitian's recommended target) went with the trimmed
    // assessment section, so new counsellings fall through to the weight the
    // client themselves named as comfortable. Both older keys are still read —
    // clients already on file keep the target they were given.
    targetWeightKg: val(a, "q5_weight") || val(a, "q82a") || val(a, "q9_weight_comfort"),
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

    activityLevel: [val(a, "q54c"), stepsLabel(a)].filter(Boolean).join(", "),
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
        // Picked staples and free text are both the food day, and the model
        // must see both: a dietitian who only tapped "Roti × 2" would
        // otherwise send an empty meal, and one who only typed would lose
        // nothing. Joined rather than either/or for the same reason.
        food_and_quantity: [list(a, stapleQuestionId(key)).join(", "), val(a, `q28_${key}_food`)]
          .filter((s) => s.trim())
          .join(" · "),
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
    physique_result: val(a, "q6") || list(a, "q6"),
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
    body_composition_data: dropNone(list(a, "q15"), ["None", "No data"]),
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
    conditions: dropNone(list(a, "q17"), ["No Medical Condition", "No known condition"]),
    condition_status: val(a, "q17a"),
    doctor_follow_up: val(a, "q17b"),
    condition_notes: val(a, "q17c"),
    medical_events: list(a, "q18").filter((v) => v !== "None"),
    // The procedure detail never used to reach the plan — only the category
    // did, so "Organ Surgery" arrived without the fact that it was a
    // gallbladder removal, which is the part that changes the fat plan.
    event_detail: val(a, "q18b"),
    event_date: val(a, "q18c"),
    event_impact: dropNone(list(a, "q18a"), ["No Impact", "No current impact"]),
    medicines: val(a, "q19") === "Yes" ? val(a, "q19a") : "none",
    recent_medicine_change: val(a, "q19b") === "No" ? null : val(a, "q19b"),
    blood_reports_available: dropNone(list(a, "q20"), ["Reports Not Available", "No recent reports"]),
    report_status: val(a, "q20a"),
    abnormal_values: val(a, "q20b"),
    symptoms: list(a, "q21").filter((v) => v !== "None"),
    symptom_frequency: val(a, "q21a"),
    symptom_doctor_assessed: val(a, "q21b"),
    safety_status: val(a, "q21c"),
    professional_instructions: dropNone(list(a, "q22"), ["No Restrictions", "No instruction"]),
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
    stool_experience: dropNone(list(a, "q25a"), ["Normal", "Comfortable and formed"]),
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
    allergy_reaction: val(a, "q27d"),
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
    weekend_changes: dropNone(list(a, "q30"), ["No Meaningful Difference", "No major change"]),
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

  // The measured current intake and the target it implies. This is the only
  // protein target the plan may use: left to itself the model picks one and
  // then quietly lowers it when the plan turns out hard to hit (observed
  // 80 -> 62 g and 140 -> 125 g across generation runs).
  const proteinEstimate = estimateProteinIntake(a);
  const target = proteinTarget(a, proteinEstimate);

  put("protein_and_supplements", clean({
    protein_sources: list(a, "q50"),
    measured_protein_intake_g_per_day: proteinEstimate.measured
      ? proteinEstimate.gramsPerDay
      : "",
    measured_protein_g_per_kg: proteinEstimate.gramsPerKg ?? "",
    protein_intake_breakdown: proteinEstimate.contributions.map(
      (c) => `${c.food.label} ${c.gramsPerDay.toFixed(1)} g/day`
    ),
    protein_intake_not_recorded_for: proteinEstimate.unrecorded.map((f) => f.label),
    week_1_protein_target_g: target.targetG || "",
    long_term_protein_goal_g: target.goalG || "",
    weekly_steps_to_protein_goal: target.weeksToGoal || "",
    protein_target_basis: target.basis,
    protein_target_reasoning: target.explanation,
    meals_with_clear_protein: val(a, "q50a"),
    protein_barriers: list(a, "q50b").filter((v) => v !== "No major barrier"),
    supplements: list(a, "q51").filter((v) => v !== "None"),
    supplements_recommended_by: val(a, "q51a"),
    supplement_side_effects: list(a, "q51b").filter((v) => v !== "None"),
    supplement_details: val(a, "q51c"),
    under_fuelling_signs: dropNone(list(a, "q52"), ["None"]),
    under_fuelling_coincided_with: list(a, "q52a"),
  }));

  put("routine_and_behaviour", clean({
    work_type: val(a, "q54"),
    shift: val(a, "q54a"),
    meal_breaks: val(a, "q54b"),
    daily_activity: val(a, "q54c"),
    average_steps: val(a, "q106"),
    weekday_steps: val(a, "q112"),
    weekend_steps: val(a, "q112a"),
    commute: val(a, "q54e"),
    hardest_food_situations: list(a, "q55").filter((v) => v !== "No specific time"),
    hardest_reasons: list(a, "q55a"),
    hunger_pattern: val(a, "q56"),
    appetite: list(a, "q57").filter((v) => v !== "No concern"),
    cravings: list(a, "q58").filter((v) => v !== "No strong cravings"),
    craving_triggers: list(a, "q58a"),
    craving_time: val(a, "q58b"),
    stress_eating: dropNone(list(a, "q59"), ["No Significant Effect", "No major effect"]),
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
    cycle_regularity: val(a, "q66_cycle"),
    last_period_start: val(a, "q66_lmp"),
    cycle_symptoms: dropNone(list(a, "q66_symptoms"), ["No noticeable change"]),
    hardest_cycle_phase: val(a, "q66_phase"),
    hormonal_contraception: ["None", "Prefer not to answer"].includes(val(a, "q66_contraception"))
      ? ""
      : val(a, "q66_contraception"),
    travel_social_situations: list(a, "q67").filter((v) => v !== "Rarely affected"),
    travel_social_effect: list(a, "q67a"),
    travel_social_frequency: val(a, "q67b"),
  }));

  put("success_dropout_coaching", clean({
    dropout_first_signs: list(a, "q68"),
    after_off_plan: val(a, "q69") || list(a, "q69"),
    support_that_helps: list(a, "q70"),
    nutrition_beliefs: list(a, "q71").filter((v) => v !== "No strong belief affecting choices"),
    belief_restriction_level: val(a, "q71a"),
    diet_structure_preference: val(a, "q72"),
    portion_explanation_preference: val(a, "q72a"),
    top_barriers_ranked: dropNone(list(a, "q73"), ["No Significant Barrier", "No major barrier"]),
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

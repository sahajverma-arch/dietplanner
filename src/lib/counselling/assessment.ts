// ---------------------------------------------------------------------------
// Reads the counselling answers back out: safety red flags (Part 4), the
// 100-point counselling quality audit (Part 11), and the two projections we
// need downstream — the legacy IntakeForm (clients table + follow-ups) and the
// rich clinical profile the AI plans from.
// ---------------------------------------------------------------------------

import type { DietType, IntakeForm } from "../types";
import { emptyIntake } from "../types";
import { answered, has, is, list, val, type Answers } from "./questions";

// ---------------------------------------------------------------------------
// RED FLAGS — clinical stops. "escalate" ones mean the plan should not be
// finalised until a medical professional has been involved.
// ---------------------------------------------------------------------------

export interface RedFlag {
  id: string;
  label: string;
  action: string;
  escalate: boolean;
}

const RULES: { when: (a: Answers) => boolean; flag: Omit<RedFlag, "id"> }[] = [
  {
    when: (a) => is(a, "q49", "Yes"),
    flag: {
      label: "Unexplained chest pain",
      action: "Medical evaluation required before any intensive exercise. Notify PT.",
      escalate: true,
    },
  },
  {
    when: (a) => is(a, "q50", "Yes"),
    flag: { label: "Fainting / loss of consciousness", action: "Medical evaluation required.", escalate: true },
  },
  {
    when: (a) => has(a, "q150", "Chest discomfort"),
    flag: { label: "Chest discomfort during exercise", action: "Stop intensive training; escalate medically.", escalate: true },
  },
  {
    when: (a) => is(a, "q203", "Yes"),
    flag: { label: "Blood in stool", action: "Medical evaluation required.", escalate: true },
  },
  {
    when: (a) => is(a, "q204", "Yes"),
    flag: { label: "Black / tar-like stool", action: "Medical evaluation required.", escalate: true },
  },
  {
    when: (a) => is(a, "q53", "Yes"),
    flag: { label: "Unexplained rapid weight loss", action: "Investigate medically before a calorie deficit.", escalate: true },
  },
  {
    when: (a) => is(a, "q54", "Yes"),
    flag: { label: "Unexplained rapid weight gain / swelling", action: "Investigate medically (cardiac, renal, thyroid).", escalate: true },
  },
  {
    when: (a) => is(a, "q194", "Frequently") || is(a, "q194", "Sometimes"),
    flag: {
      label: "Possible binge-eating pattern",
      action: "Do NOT intensify restriction. Refer to an appropriately qualified professional.",
      escalate: true,
    },
  },
  {
    when: (a) => is(a, "q219", "Yes"),
    flag: { label: "Breathing pauses during sleep", action: "Consider evaluation for sleep-disordered breathing.", escalate: false },
  },
  {
    when: (a) => is(a, "q232", "Yes"),
    flag: {
      label: "Pregnant",
      action: "No aggressive deficit or standard fat-loss protocol. Coordinate with treating clinician.",
      escalate: true,
    },
  },
  {
    when: (a) => is(a, "q233", "Yes"),
    flag: { label: "Breastfeeding", action: "Avoid aggressive transformation protocols.", escalate: false },
  },
  {
    when: (a) => has(a, "q41", "Kidney disease"),
    flag: {
      label: "Kidney disease — renal safety branch",
      action: "No generic high-protein plan. Protein/fluid/electrolytes per nephrologist.",
      escalate: true,
    },
  },
  {
    when: (a) => is(a, "q55", "Yes"),
    flag: { label: "Doctor has restricted exercise", action: "PT handover required with restrictions.", escalate: false },
  },
  {
    when: (a) => is(a, "q124", "Yes"),
    flag: {
      label: "Diagnosed food allergy",
      action: "Allergen must never appear in any meal, in any form or preparation.",
      escalate: false,
    },
  },
  {
    when: (a) => is(a, "d5", "Frequently") || is(a, "d5", "Sometimes"),
    flag: {
      label: "Hypoglycaemia episodes",
      action: "Escalate before any calorie deficit. Do not alter diabetes medication.",
      escalate: true,
    },
  },
  {
    when: (a) => is(a, "q46", "Yes"),
    flag: {
      label: "Doctor-advised food restriction",
      action: "The doctor's restriction overrides plan design.",
      escalate: false,
    },
  },
  {
    when: (a) => is(a, "q205", "Yes"),
    flag: { label: "Persistent change in bowel habits", action: "Medical evaluation recommended.", escalate: false },
  },
];

export function redFlags(a: Answers): RedFlag[] {
  return RULES.filter((r) => r.when(a)).map((r, i) => ({ id: `rf${i}`, ...r.flag }));
}

// ---------------------------------------------------------------------------
// PART 11 — counselling quality audit (100 points). Points are earned for
// information actually captured, so the score doubles as live progress.
// ---------------------------------------------------------------------------

export interface AuditCategory {
  name: string;
  earned: number;
  max: number;
  missing: string[];
}

type Item = { ids: string[]; points: number; label: string };

const RUBRIC: { name: string; items: Item[] }[] = [
  {
    name: "Goal understanding",
    items: [
      { ids: ["q4"], points: 3, label: "Primary goal" },
      { ids: ["q2"], points: 2, label: "Secondary goal" },
      { ids: ["s_objective"], points: 2, label: "Body composition objective" },
      { ids: ["q3"], points: 2, label: "Client success expectation" },
      { ids: ["q8"], points: 1, label: "Timeline" },
    ],
  },
  {
    name: "Body & weight history",
    items: [
      { ids: ["q11", "q12", "q13"], points: 2, label: "Anthropometrics" },
      { ids: ["q14", "q16"], points: 2, label: "Weight timeline" },
      { ids: ["q21"], points: 2, label: "Weight gain/loss trigger" },
      { ids: ["q25"], points: 2, label: "Plateau history" },
    ],
  },
  {
    name: "Clinical assessment",
    items: [
      { ids: ["q41"], points: 5, label: "Medical history" },
      { ids: ["q56"], points: 3, label: "Medication" },
      { ids: ["q68"], points: 3, label: "Blood reports" },
      { ids: ["q46"], points: 2, label: "Clinical restrictions" },
      { ids: ["q49", "q50", "q203"], points: 2, label: "Red-flag screen" },
    ],
  },
  {
    name: "Diet recall quality",
    items: [
      { ids: ["q80", "q90", "q103"], points: 5, label: "Complete 24-hour recall" },
      { ids: ["q81", "q91"], points: 3, label: "Portions" },
      { ids: ["q82"], points: 2, label: "Preparation" },
      { ids: ["q79", "q89", "q102"], points: 2, label: "Meal timing" },
      { ids: ["q108"], points: 2, label: "Weekend pattern" },
      { ids: ["q109"], points: 1, label: "Eating out" },
    ],
  },
  {
    name: "Protein & fitness nutrition",
    items: [
      { ids: ["q133", "q138"], points: 3, label: "Protein sources" },
      { ids: ["q131", "q132"], points: 2, label: "Protein distribution" },
      { ids: ["q98"], points: 2, label: "Pre-workout" },
      { ids: ["q100"], points: 2, label: "Post-workout" },
      { ids: ["q61"], points: 1, label: "Supplement assessment" },
    ],
  },
  {
    name: "Training assessment",
    items: [
      { ids: ["q145"], points: 2, label: "Training frequency" },
      { ids: ["q148"], points: 2, label: "Training history" },
      { ids: ["q151"], points: 1, label: "Energy" },
      { ids: ["q152"], points: 1, label: "Recovery" },
      { ids: ["q158"], points: 1, label: "Injury" },
      { ids: ["pt_goal"], points: 1, label: "PT handover" },
    ],
  },
  {
    name: "Lifestyle assessment",
    items: [
      { ids: ["q166", "q168"], points: 2, label: "Work routine" },
      { ids: ["q175"], points: 1, label: "Cooking" },
      { ids: ["q176"], points: 1, label: "Food access" },
      { ids: ["q213"], points: 2, label: "Sleep" },
      { ids: ["q221"], points: 1, label: "Stress" },
      { ids: ["q242"], points: 1, label: "Travel" },
    ],
  },
  {
    name: "Food preference",
    items: [
      { ids: ["q121"], points: 2, label: "Food pattern" },
      { ids: ["q122"], points: 2, label: "Liked foods" },
      { ids: ["q123"], points: 1, label: "Disliked foods" },
      { ids: ["q116"], points: 1, label: "Cultural food pattern" },
      { ids: ["q129"], points: 1, label: "Food availability" },
      { ids: ["q181"], points: 1, label: "Budget" },
    ],
  },
  {
    name: "Adherence assessment",
    items: [
      { ids: ["q256"], points: 3, label: "Top barriers" },
      { ids: ["q260"], points: 2, label: "Non-negotiables" },
      { ids: ["q252"], points: 2, label: "Diet preference" },
      { ids: ["q263"], points: 1, label: "Readiness" },
      { ids: ["q265"], points: 2, label: "Confidence" },
    ],
  },
  {
    name: "Closing & strategy",
    items: [
      { ids: ["s_blocking"], points: 2, label: "Summary provided" },
      { ids: ["s_p1", "s_p2", "s_p3"], points: 2, label: "Priorities explained" },
      { ids: ["pt_coord"], points: 1, label: "PT coordination" },
      { ids: ["pl_structure"], points: 1, label: "Plan structure decided" },
      { ids: ["q265"], points: 2, label: "Client confidence checked" },
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
      // An item counts when every question it depends on has an answer.
      if (item.ids.every((id) => answered(a, id))) earned += item.points;
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
  Vegan: "vegan",
  Eggetarian: "eggetarian",
  "Non-vegetarian": "non-vegetarian",
  Pescatarian: "non-vegetarian",
};

const joinList = (a: Answers, id: string) => list(a, id).filter((v) => v !== "None").join(", ");

export interface ClinicalIntake extends IntakeForm {
  /** Every answer, keyed by question id. */
  answers: Answers;
  /** Appointment this counselling was started from, if any. */
  appointmentId?: string | null;
}

export function toIntake(a: Answers, appointmentId?: string | null): ClinicalIntake {
  const conditions = list(a, "q41").filter((c) => c !== "None known");
  if (is(a, "q231", "Yes") && !conditions.includes("PCOS/PCOD")) conditions.push("PCOS/PCOD");

  const allergyDetail = val(a, "q124a").trim();
  const intolerances = [joinList(a, "q125"), val(a, "q126").trim()].filter(Boolean).join("; ");

  const exercise = [
    joinList(a, "q144"),
    val(a, "q145") ? `${val(a, "q145")} days/week` : "",
    val(a, "q147") ? `usually ${val(a, "q147").toLowerCase()}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  return {
    ...emptyIntake,
    fullName: val(a, "name").trim(),
    age: val(a, "q13"),
    gender: val(a, "gender"),
    heightCm: val(a, "q12"),
    weightKg: val(a, "q11"),
    targetWeightKg: val(a, "q6a"),
    phone: val(a, "phone"),
    email: val(a, "email"),
    occupation: val(a, "q166"),
    goal: val(a, "s_objective") || val(a, "q4"),

    dietType: DIET_TYPE[val(a, "q121")] ?? "vegetarian",
    cuisines: [val(a, "q116"), joinList(a, "q111")].filter(Boolean).join(", "),
    mealsPerDay: val(a, "pl_meals"),
    likes: val(a, "q122"),
    dislikes: val(a, "q123"),
    allergies: allergyDetail,
    intolerances,
    cookingTime: val(a, "q178"),

    activityLevel: [val(a, "q156"), val(a, "q157") ? `${val(a, "q157")} h sitting` : ""]
      .filter(Boolean)
      .join(", "),
    exercise,
    sleepHours: val(a, "q213"),
    wakeTime: val(a, "q212"),
    bedTime: val(a, "q211"),
    waterIntakeLitres: val(a, "q206"),
    smoking: val(a, "q239"),
    alcohol: val(a, "q236"),
    eatingOutPerWeek: val(a, "q109"),
    workSchedule: [val(a, "q168"), val(a, "q169")].filter(Boolean).join(" · "),

    conditions,
    medications: val(a, "q57"),
    supplements: joinList(a, "q62"),
    digestion: joinList(a, "q197"),
    labNotes: [joinList(a, "q72"), val(a, "q72a")].filter(Boolean).join(" — "),

    notes: val(a, "pl_notes"),
    answers: a,
    appointmentId: appointmentId ?? null,
  };
}

// ---------------------------------------------------------------------------
// Clinical profile for the AI. Only sections with content are emitted, so the
// prompt stays tight for a light counselling and rich for a full one.
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

export function aiProfile(a: Answers): Block {
  const flags = redFlags(a);

  const profile: Block = {};
  const put = (key: string, block: Block | null) => {
    if (block) profile[key] = block;
  };

  put("goal", clean({
    primary_goal: val(a, "q4"),
    body_composition_objective: val(a, "s_objective"),
    wants: list(a, "q2"),
    success_looks_like: val(a, "q3"),
    target_weight_kg: val(a, "q6a"),
    event_or_deadline: list(a, "q8").filter((v) => v !== "No fixed date"),
    priority_metric: val(a, "q30"),
  }));

  put("body", clean({
    age: val(a, "q13"),
    gender: val(a, "gender"),
    height_cm: val(a, "q12"),
    weight_kg: val(a, "q11"),
    six_month_trend: val(a, "q22"),
    plateau: val(a, "q25") === "Yes" ? val(a, "q26") : null,
    self_described_composition: val(a, "q37"),
    body_fat_percent: val(a, "q33"),
  }));

  put("clinical", clean({
    conditions: list(a, "q41").filter((c) => c !== "None known"),
    control: val(a, "q44"),
    doctor_food_restriction: val(a, "q46") === "Yes" ? val(a, "q46a") : null,
    medications: val(a, "q57"),
    supplements: list(a, "q62"),
    abnormal_labs: list(a, "q72"),
    lab_notes: val(a, "q72a"),
    digestive_symptoms: list(a, "q197").filter((s) => s !== "None"),
    dairy_tolerance: val(a, "q135"),
    pregnant: val(a, "q232") === "Yes" ? true : null,
    breastfeeding: val(a, "q233") === "Yes" ? true : null,
    pcos: is(a, "q231", "Yes") || has(a, "q41", "PCOS/PCOD") ? true : null,
    hba1c: val(a, "d1"),
    renal_protein_restriction: val(a, "k7"),
    thyroid_medication_timing: val(a, "t3"),
  }));

  if (flags.length) {
    profile.red_flags = flags.map((f) => `${f.label} — ${f.action}`);
  }

  put("food_rules", clean({
    diet_pattern: val(a, "q121"),
    allergies_never_include: val(a, "q124a"),
    intolerances: list(a, "q125").filter((v) => v !== "None"),
    foods_causing_discomfort: val(a, "q126"),
    dislikes: val(a, "q123"),
    likes_keep_these: val(a, "q122"),
    non_negotiables_keep_in_plan: list(a, "q260"),
    cultural_or_religious: val(a, "q119a"),
    fasting: val(a, "q120"),
    too_expensive: val(a, "q128"),
    hard_to_find: val(a, "q129"),
    cannot_cook: val(a, "q130"),
  }));

  put("current_diet", clean({
    wake_time: val(a, "q74"),
    first_intake: val(a, "q75"),
    tea_coffee_prep: val(a, "q78"),
    breakfast_time: val(a, "q79"),
    breakfast: val(a, "q80"),
    breakfast_portions: val(a, "q81"),
    mid_morning: val(a, "q88"),
    lunch_time: val(a, "q89"),
    lunch: val(a, "q90"),
    lunch_grain_portion: val(a, "q91"),
    lunch_protein: list(a, "q92"),
    afternoon: val(a, "q93"),
    evening: val(a, "q96"),
    dinner_time: val(a, "q102"),
    dinner: val(a, "q103"),
    after_dinner: val(a, "q104"),
    typical_day: val(a, "q106"),
    normal_day_differences: val(a, "q107"),
    cooking_methods: list(a, "q82"),
    weekend_pattern: list(a, "q108"),
    meals_out_per_week: val(a, "q109"),
    meals_not_in_client_control: val(a, "q112"),
    regional_pattern: val(a, "q116"),
    household_staples: list(a, "q117"),
  }));

  put("protein", clean({
    meals_with_protein: val(a, "q131"),
    protein_at_breakfast: val(a, "q132"),
    vegetarian_sources: list(a, "q133"),
    non_veg_sources: list(a, "q138"),
    non_veg_frequency: val(a, "q139"),
    eggs: val(a, "q136") === "Yes" ? val(a, "q137") || "yes" : "no",
    willing_to_increase: val(a, "q140"),
    barriers: list(a, "q141"),
    protein_powder: val(a, "q142"),
  }));

  put("training", clean({
    currently_exercising: val(a, "q143"),
    modes: list(a, "q144"),
    days_per_week: val(a, "q145"),
    training_time: val(a, "q147"),
    strength_training_experience: val(a, "q148"),
    level: val(a, "q149"),
    workout_energy_1_10: val(a, "q151"),
    recovery: val(a, "q152"),
    strength_trend: val(a, "q154"),
    daily_steps: val(a, "q156"),
    sitting_hours: val(a, "q157"),
    injuries: list(a, "q159"),
    exercise_restricted_by_doctor: val(a, "q55"),
    committed_training_days: val(a, "q165"),
    pre_workout_now: val(a, "q98"),
    post_workout_now: val(a, "q100"),
  }));

  put("lifestyle", clean({
    occupation: val(a, "q166"),
    work_arrangement: val(a, "q167"),
    work_timing: val(a, "q168"),
    shift: val(a, "q169"),
    hardest_time_to_follow_diet: val(a, "q171"),
    least_controlled_meal: val(a, "q172"),
    can_carry_food: val(a, "q174"),
    who_cooks: val(a, "q175"),
    kitchen: val(a, "q176"),
    prep_time_available: val(a, "q178"),
    batch_cooking: val(a, "q179"),
    budget_preference: val(a, "q181"),
    hard_to_buy: list(a, "q182"),
    water_intake: val(a, "q206"),
    sleep_hours: val(a, "q213"),
    sleep_quality_1_10: val(a, "q214"),
    stress_1_10: val(a, "q221"),
    alcohol: val(a, "q236"),
    smoking: val(a, "q239"),
    caffeine_per_day: val(a, "q240"),
    travel_frequency: val(a, "q242"),
    travel_eating: list(a, "q244"),
    social_meals: val(a, "q245"),
  }));

  put("behaviour", clean({
    hungriest: list(a, "q183"),
    eating_speed: val(a, "q185"),
    stops_eating_when: val(a, "q186"),
    cravings: list(a, "q189"),
    craving_frequency: val(a, "q190"),
    craving_triggers: list(a, "q191"),
    stress_eating: list(a, "q192"),
    previous_diets: list(a, "q247"),
    why_stopped: list(a, "q249"),
    never_repeat: val(a, "q250"),
    adherence_style: list(a, "q251"),
    options_preferred: val(a, "q252"),
    portion_style: val(a, "q253"),
    support_style: list(a, "q255"),
    barriers_ranked: [val(a, "q257"), val(a, "q258"), val(a, "q259")].filter(Boolean),
    change_capacity_first_2_weeks: val(a, "q262"),
    readiness_1_10: val(a, "q263"),
    confidence_1_10: val(a, "q265"),
    confidence_blocker: val(a, "q266") || val(a, "q264"),
  }));

  put("dietitian_plan", clean({
    whats_blocking_the_client: val(a, "s_blocking"),
    nutrition_gaps: list(a, "s_gaps"),
    priorities: [val(a, "s_p1"), val(a, "s_p2"), val(a, "s_p3")].filter(Boolean),
    clinical_restrictions: val(a, "s_restrictions"),
    diet_structure: val(a, "pl_structure"),
    protein_strategy: val(a, "pl_protein"),
    carb_strategy: val(a, "pl_carb"),
    fat_strategy: val(a, "pl_fat"),
    meal_structure: val(a, "pl_meals"),
    meal_structure_reason: val(a, "pl_meals_why"),
    fourteen_day_priorities: [val(a, "pl_priority1"), val(a, "pl_priority2"), val(a, "pl_priority3")].filter(Boolean),
    dietitian_notes: val(a, "pl_notes"),
  }));

  return profile;
}

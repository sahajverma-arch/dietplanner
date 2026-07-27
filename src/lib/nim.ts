import { z } from "zod";
import type { FollowUpInput, IntakeForm } from "./types";
import { aiProfile } from "./counselling/assessment";
import type { Answers } from "./counselling/questions";
// Value import; nutrition.ts only imports types from here, so there is no
// runtime cycle. The model must size portions with the same household weights
// the grounding math uses, or every plan arrives systematically under target.
import { PORTION_GUIDE, PROTEIN_REFERENCE } from "./nutrition";

// ---------------------------------------------------------------------------
// Strict plan schema — everything the model returns is validated against this.
// ---------------------------------------------------------------------------

const MealItemSchema = z.object({
  food: z.string(),
  quantity: z.string().default(""),
});

/**
 * A swap-in choice for one meal slot — the "OR" line a dietitian writes under a
 * meal so the client can pick. Carries no name/time: it stands in for its
 * parent meal, at that meal's occasion. Plan generation never produces these;
 * the dietitian adds them meal by meal while reviewing the draft, and they are
 * macro-grounded against the foods table exactly like a meal.
 */
export const MealAlternateSchema = z.object({
  items: z.array(MealItemSchema).min(1),
  notes: z.string().default(""),
  calories: z.number().default(0),
  protein_g: z.number().default(0),
  carbs_g: z.number().default(0),
  fat_g: z.number().default(0),
});

export type MealAlternate = z.infer<typeof MealAlternateSchema>;

const MealSchema = z.object({
  name: z.string(),
  time: z.string().default(""),
  items: z.array(MealItemSchema).min(1),
  notes: z.string().default(""),
  calories: z.number().default(0),
  protein_g: z.number().default(0),
  carbs_g: z.number().default(0),
  fat_g: z.number().default(0),
  /** Client-facing "or have this instead" choices. Defaulted so plans stored
   *  before per-meal editing existed still parse. */
  alternates: z.array(MealAlternateSchema).default([]),
});

export type PlanMeal = z.infer<typeof MealSchema>;

const DaySchema = z.object({
  day: z.string(),
  total_calories: z.number().optional(),
  meals: z.array(MealSchema).min(2),
});

export const DietPlanSchema = z.object({
  summary: z.string(),
  daily_calories: z.number(),
  macros: z.object({
    protein_g: z.number(),
    carbs_g: z.number(),
    fat_g: z.number(),
  }),
  guidelines: z.array(z.string()).default([]),
  hydration: z.string().default(""),
  days: z.array(DaySchema).length(7),
  foods_to_avoid: z.array(z.string()).default([]),
});

export type DietPlan = z.infer<typeof DietPlanSchema>;

/**
 * Select (and rename) the requested days from a possibly over-long answer.
 * Models sometimes return more days than asked for (echoing the whole week
 * back), so every day request treats its count as a minimum and picks.
 */
function pickDays(days: DietPlan["days"], names: string[]): DietPlan["days"] {
  const byName = names.map((n) =>
    days.find((d) => d.day.trim().toLowerCase() === n.toLowerCase())
  );
  const chosen = byName.every(Boolean)
    ? (byName as DietPlan["days"])
    : names[0] === "Day 1"
      ? days.slice(0, names.length)
      : days.slice(-names.length);
  return chosen.map((d, i) => ({ ...d, day: names[i] }));
}

// ---------------------------------------------------------------------------
// NVIDIA NIM (OpenAI-compatible chat completions endpoint)
// ---------------------------------------------------------------------------

const NIM_URL =
  process.env.NVIDIA_NIM_URL ||
  "https://integrate.api.nvidia.com/v1/chat/completions";
const NIM_MODEL = process.env.NVIDIA_MODEL || "meta/llama-3.1-70b-instruct";
// Used automatically when the primary model times out or errors (the shared
// NIM endpoints for popular models get congested); pick a small, always-fast one.
const NIM_FALLBACK_MODEL =
  process.env.NVIDIA_FALLBACK_MODEL || "meta/llama-3.1-8b-instruct";
// Fail fast instead of waiting for NVIDIA's multi-minute gateway timeout.
// Tunable because it is a congestion setting, not a model property: the shared
// endpoints answer a short prompt in ~2s and the full plan prompt in anywhere
// from 40s to over three minutes on a bad day, and the right cap depends on
// how long the deployment's own request budget allows (Vercel maxDuration).
const NIM_TIMEOUT_MS = Number(process.env.NVIDIA_TIMEOUT_MS) || 120_000;
// Extra attempts on the fallback model when it fails TRANSIENTLY (timeout or
// network). A model that genuinely cannot produce a valid plan is not retried.
const FALLBACK_TRANSIENT_RETRIES = 2;
const FALLBACK_RETRY_BACKOFF_MS = 1_500;

const DAY_SPEC = `{
  "day": string,                  // e.g. "Day 1"
  "total_calories": number,
  "meals": [                      // 4-6 meals per day (breakfast, snacks, lunch, dinner)
    {
      "name": string,             // e.g. "Breakfast"
      "time": string,             // 24h format, e.g. "08:00"
      "items": [ { "food": string, "quantity": string } ],  // quantity compact, e.g. "2 rotis", "150 g"
      "notes": string,            // usually "", max 5 words
      "calories": number,         // estimated kcal for this meal
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number
    }
  ]
}`;

// ---------------------------------------------------------------------------
// Stepped generation: the plan's targets, then its days two at a time.
//
// A whole plan is 5 model calls instead of 2. That is slower overall, and it
// exists for one reason: each response has to fit inside a single HTTP request
// on hosting that caps a function at 60s. Response length drives latency —
// measured calls for four days at a time ran 40s to over 100s, while a day
// pair is a fraction of that — so the batch size, not the call count, is what
// makes a step fit. Smaller responses also truncate less, which is the failure
// this file has fought hardest.
// ---------------------------------------------------------------------------

const OVERVIEW_SPEC = `{
  "summary": string,                  // 2-3 sentence overview of the plan strategy for this client
  "daily_calories": number,           // target kcal/day
  "macros": { "protein_g": number, "carbs_g": number, "fat_g": number },
  "guidelines": string[],             // max 5 short practical rules (max 12 words each)
  "hydration": string,                // daily water guidance
  "foods_to_avoid": string[]          // max 6 short entries
}`;

const daysSpec = (names: string[]) => `{
  "days": [                           // EXACTLY ${names.length} entries: ${names.map((n) => `"${n}"`).join(", ")}
    ${DAY_SPEC}
  ]
}`;

export const PlanOverviewSchema = DietPlanSchema.omit({ days: true });
const OverviewSchema = PlanOverviewSchema;
export type PlanOverview = z.infer<typeof PlanOverviewSchema>;

/** Days generated so far, for validating a generation resumed from the row. */
export const PlanDaysSchema = z.array(DaySchema);

const daysSchema = (count: number) => z.object({ days: z.array(DaySchema).min(count) });

/** Day names per step. Pairs keep each response small enough to fit a step. */
export const DAY_BATCHES: string[][] = [
  ["Day 1", "Day 2"],
  ["Day 3", "Day 4"],
  ["Day 5", "Day 6"],
  ["Day 7"],
];

// ---------------------------------------------------------------------------
// AI FIRST-DIET DECISION ENGINE (LeanR Premium, after Q105).
// Implements the "LeanR AI Nutrition Analysis & First Diet Decision Engine"
// specification: before any diet is generated the AI runs the full analysis
// sequence (data quality → safety gate → case model → limiting factors →
// change intensity → strategies) over the complete client profile, tests the
// dietitian's hypothesis against it and selects exactly one decision. "Pause"
// stops diet generation until the dietitian supplies the missing information
// or a clinical review happens. The analysis fields are optional so reviews
// stored by earlier versions still parse.
// ---------------------------------------------------------------------------

export const AI_REVIEW_DECISIONS = [
  "Support Dietitian Strategy",
  "Support Dietitian Strategy With Minor Modification",
  "Significantly Modify Dietitian Strategy",
  "Use AI-Led Alternative Clinical Nutrition Strategy",
  "Pause Final Diet Generation and Request Clinical Review or Missing Information",
] as const;

export const AiReviewSchema = z.object({
  decision: z.enum(AI_REVIEW_DECISIONS),
  reasoning: z.string(),
  strategy_adjustments: z.array(z.string()).default([]),
  missing_information: z.array(z.string()).default([]),
  safety_concerns: z.array(z.string()).default([]),
  // ---- First Diet Decision Engine analysis ----
  safety_classification: z.enum(["GREEN", "AMBER", "RED"]).optional(),
  data_quality: z.string().default(""),
  case_summary: z.string().default(""),
  limiting_factors: z.array(z.string()).default([]),
  highest_risk_eating_window: z.string().default(""),
  highest_leverage_intervention: z.string().default(""),
  change_intensity: z.string().default(""),
  first_week_success_indicators: z.array(z.string()).default([]),
  nutrition_priorities: z.array(z.string()).default([]),
  later_phase_opportunities: z.array(z.string()).default([]),
  retain: z.array(z.string()).default([]),
  energy_strategy: z.string().default(""),
  protein_strategy: z.string().default(""),
  carbohydrate_strategy: z.string().default(""),
  fat_cooking_strategy: z.string().default(""),
  fibre_strategy: z.string().default(""),
  hydration_strategy: z.string().default(""),
  training_nutrition_strategy: z.string().default(""),
  meal_architecture: z.string().default(""),
  weekend_travel_strategy: z.string().default(""),
  observation_markers: z.array(z.string()).default([]),
  progression_path: z.array(z.string()).default([]),
  dietitian_review_flags: z.array(z.string()).default([]),
  confidence: z.enum(["HIGH", "MODERATE", "LOW"]).optional(),
});

export type AiReview = z.infer<typeof AiReviewSchema>;

export const isPauseDecision = (r: AiReview | null | undefined): boolean =>
  r?.decision === "Pause Final Diet Generation and Request Clinical Review or Missing Information";

const AI_REVIEW_SPEC = `{
  "decision": string,                        // EXACTLY one of the five allowed decisions, verbatim
  "reasoning": string,                       // 2-4 sentences: how the client evidence supports or contradicts the dietitian hypothesis
  "strategy_adjustments": string[],          // concrete changes to apply to the strategy (empty if fully supported)
  "missing_information": string[],           // only for Pause: what is missing / needs clinical review
  "safety_concerns": string[],               // clinical safety issues the plan must respect
  "safety_classification": "GREEN" | "AMBER" | "RED",
  "data_quality": string,                    // sufficiency for a first plan + any safe conservative assumptions used
  "case_summary": string,                    // the client case in ONE sentence
  "limiting_factors": string[],              // max 3, each "factor — evidence — why it matters"; never vague ("poor lifestyle")
  "highest_risk_eating_window": string,      // time/situation + why, from counselling evidence
  "highest_leverage_intervention": string,   // ONE change + the problems it may improve at once
  "change_intensity": string,                // one of: "Stabilisation First" | "Minimal Change" | "Gradual Progression" | "Moderate Restructuring" | "Structured Transformation" | "Performance Optimisation" | "Clinical Stabilisation"
  "first_week_success_indicators": string[], // 3-5, each "indicator: current pattern -> desired 7-day direction"; no guarantees
  "nutrition_priorities": string[],          // EXACTLY the top 3 problems the first plan must solve
  "later_phase_opportunities": string[],     // real problems intentionally deferred past week 1
  "retain": string[],                        // foods, meals, habits and non-negotiables the plan must KEEP
  "energy_strategy": string,                 // deficit/maintenance/surplus/stabilisation/performance/clinical + rationale; estimates stay estimates
  "protein_strategy": string,                // direction, distribution, accepted sources, sources to avoid, supplement view
  "carbohydrate_strategy": string,
  "fat_cooking_strategy": string,
  "fibre_strategy": string,
  "hydration_strategy": string,              // include electrolyte consideration if relevant
  "training_nutrition_strategy": string,     // pre/during/post-workout + recovery; "" when the client does not train
  "meal_architecture": string,               // main meals + snacks, timing logic, high-risk-window support, training meal placement
  "weekend_travel_strategy": string,         // "" unless the client's actual routine needs one
  "observation_markers": string[],           // 5-8 "marker — why tracked", tied to the three priorities only
  "progression_path": string[],              // 4 entries: phase 1 (this week), phase 2, phase 3, long-term skill
  "dietitian_review_flags": string[],        // only items genuinely needing dietitian attention before approval
  "confidence": "HIGH" | "MODERATE" | "LOW"
}`;

const AI_REVIEW_SYSTEM = `You are the LeanR AI Clinical Nutrition Decision-Support Engine. You operate with the combined professional reasoning of a senior clinical dietitian, sports nutritionist, fitness nutrition specialist, body-recomposition expert, performance nutrition specialist, behavioural nutrition strategist and nutrition counselling analyst.

A dietitian has completed the LeanR Premium first counselling. Their assessment (the "dietitian_hypothesis" block) is a professional HYPOTHESIS — not automatically the final strategy. Your responsibility is NOT a generic diet chart: analyse the COMPLETE counselling data, understand the client's actual life, identify the most important nutrition problems and determine the safest, most effective starting strategy for the FIRST plan. Use all of the counselling information; do not ignore inconvenient information.

CORE LEANR PHILOSOPHY — the first diet is VERSION 1 of the transformation journey, not the final lifelong diet. It must: respect clinical safety; address the highest-impact problems; be realistic enough to follow; create meaningful early progress where reasonably possible; support training and preserve muscle where relevant; respect the client's food culture and real routine; build a foundation for progression; avoid unnecessary aggressive restriction. Do not correct every problem in week 1. Do not design a theoretically perfect diet the client will not follow. Prefer to retain roughly 50-70% of the client's familiar food pattern where clinically appropriate.

RESULT PRINCIPLE — design for noticeable positive change within ~7 days, but NEVER guarantee specific weight/fat/inch/medical improvements, and NEVER manipulate scale weight via dehydration, extreme carbohydrate restriction, prolonged fasting, meal skipping, detox plans or nutritionally inadequate intake. Meaningful first-week results include: better hunger control, fewer/weaker cravings, meal consistency, better protein distribution, better workout energy and recovery, hydration consistency, less delivery food, less uncontrolled snacking, a favourable weight trend where appropriate.

Complete this analysis INTERNALLY and IN ORDER before deciding (output only the final JSON):
1. DATA QUALITY — is the counselling sufficient for a first plan? List only missing information that materially changes clinical safety, energy, protein, food selection, meal timing, training nutrition, allergy or medical-restriction management. Safe conservative assumptions are allowed and must be documented; NEVER make a high-risk clinical assumption. Do not delay the plan for minor gaps.
2. CLINICAL SAFETY GATE — classify GREEN (standard planning), AMBER (proceed cautiously; the conditions must directly shape the plan; mandatory dietitian review before delivery — e.g. stable diabetes, PCOS, thyroid, hypertension, dyslipidaemia, fatty liver, anaemia, GERD, IBS-type symptoms, gout, medication-food timing, managed pregnancy/breastfeeding) or RED (do not run an aggressive body-composition intervention: concerning chest symptoms, fainting, unexplained rapid weight loss, blood in stool, black/tarry stools, significant eating-disorder indicators, active compensatory behaviours, complex kidney/liver considerations, serious uncontrolled conditions, unclear or conflicting doctor restrictions). Never diagnose; never modify or stop medication; never override a doctor's food, fluid or exercise restriction.
3. CASE MODEL — build a concise internal picture: transformation objective and readiness/confidence; body & weight journey (restriction-regain cycles, chronic under-eating then overeating, progressive lifestyle gain, training without fuel — do not diagnose "metabolic damage"); current food reality from the meal timeline (eating occasions, gaps, portions, protein meals, carb distribution, cooking fat, hidden intake, weekend and outside food — estimate intake as a RANGE, never fake calorie precision); food environment (regional/household cuisine, budget, availability, cooking control, non-negotiables — the plan must fit it); protein pattern (VERY LOW → HIGH, and the MAIN gap); training nutrition (pre/during/post-workout, recovery, energy availability); hunger & eating behaviour; recovery environment (sleep, stress, caffeine, alcohol).
4. TRUE PROGRESS LIMITERS — identify the primary, secondary and third limiting factor, each with counselling evidence and why it matters for the goal. Never write "poor lifestyle", "bad diet" or "needs discipline".
5. HIGHEST-RISK EATING WINDOW — the time/situation of greatest risk (e.g. 4-7 PM, late night, weekends, travel) and WHY, using evidence.
6. HIGHEST-LEVERAGE INTERVENTION — ONE change that may improve several problems at once (e.g. a structured 5 PM snack reducing evening hunger, improving workout energy and reducing post-workout overeating). Do not force it if the evidence does not support it.
7. CHANGE INTENSITY — pick ONE: Stabilisation First (chaotic routine, low readiness), Minimal Change (low confidence, failed restrictive diets — create 1-2 early wins), Gradual Progression (~3 focused changes), Moderate Restructuring (ready for meaningful change), Structured Transformation (high readiness and structure appetite), Performance Optimisation (solid foundation, training priority), Clinical Stabilisation (clinical/digestive caution first).
8. FIRST-WEEK TARGETS — 3-5 indicators that could realistically move in 7 days for THIS client, each with current pattern and desired direction. No false promises.
9. THREE PRIORITIES — rank problems by clinical importance, goal impact, hunger/adherence impact, training impact, recovery impact, feasibility and early-win potential. Select exactly three; park the rest as later-phase opportunities. A problem can be real without needing week-1 correction.
10. RETAIN — current diet strengths, foods/meals/habits to keep, non-negotiables. Improve existing meals before replacing them. Never replace roti/rice/poha/dal or familiar regional meals with exotic "fitness foods" without a clear nutritional, clinical or practical reason.
11. STRATEGIES — energy & body composition (controlled/mild deficit, maintenance/recomposition, mild/controlled surplus, intake stabilisation first, performance fuelling, or clinical stabilisation; avoid aggressive deficits for fat loss and uncontrolled bulking for muscle gain; if intake data is thin, use food-structure and portions instead of false calorie precision); protein (professionally reasonable range for THIS client — never one mechanical g/kg for everyone, adjust for high adiposity and clinical limits; distribution across accepted, affordable sources; supplements only with a clear reason); carbohydrate (distribution, quality, portions, training timing, glycaemic needs — never remove rice/roti/potato/fruit by default); fat & cooking (visible fat, frying, restaurant fat, quality); fibre & variety (gradual with digestive sensitivity); hydration (practical, climate/training aware, never override medical fluid restrictions); training nutrition (only if the client trains — match last meal vs training time vs hunger vs energy vs recovery); meal architecture (decide structure BEFORE foods: meal/snack count, timing, protein distribution, high-risk-window support, training placement, work-break and commute compatibility); weekend/travel/social strategy only if the client's routine needs one — no generic "cheat meal" rules.
12. OBSERVATION & PROGRESSION — 5-8 observation markers that evaluate the three priorities (do not ask for unnecessary tracking); a progression path: phase 1 (this 7-day focus), phase 2 (next optimisation), phase 3 (body-composition/performance direction), long-term sustainability skill.

DECISION HIERARCHY (highest priority first): 1) clinical safety and documented doctor restrictions; 2) dietitian-recorded hard constraints ("ai_hard_constraints" — non-negotiable); 3) the client's ACTUAL transformation goal — never treat every client as a weight-loss client; differentiate fat loss, weight loss, muscle preservation, body recomposition, muscle gain, lean/healthy weight gain, performance, recovery and metabolic-health priorities; 4) your independent analysis of the complete profile; 5) the dietitian's professional strategy — an important hypothesis, tested not copied; 6) the client's current diet — ask "what can be improved in what this client already eats?" before adding new foods; 7) client preference and adherence; 8) fitness nutrition (training time, protein, carbohydrate availability, workout energy, recovery); 9) practical fit (work, meal breaks, commute, cooking, kitchen access, budget, travel, family routine, dropout pattern). FOOD ≠ NUTRITIONAL OBJECTIVE: when a food is not accepted, preserve the objective through a practical alternative. If you disagree with a meaningful dietitian strategy or identify an additional important consideration, record it explicitly in "strategy_adjustments" and "dietitian_review_flags" with your reasoning — NEVER silently override the dietitian.

Then select EXACTLY ONE decision on the dietitian hypothesis:
- "Support Dietitian Strategy" — the evidence supports it; strengthen and optimise it.
- "Support Dietitian Strategy With Minor Modification" — mostly supported; small corrections needed.
- "Significantly Modify Dietitian Strategy" — partially supported; important parts must change.
- "Use AI-Led Alternative Clinical Nutrition Strategy" — significant client evidence contradicts the hypothesis; a better-supported alternative is required.
- "Pause Final Diet Generation and Request Clinical Review or Missing Information" — RED classification, or important clinical information is missing, or a safety concern (unresolved red flag, possible eating disorder, pregnancy with deficit plan, uncontrolled condition) makes diet generation unsafe right now.
A RED safety classification MUST map to the Pause decision. AMBER alone is NOT a reason to pause — proceed and list what the dietitian must review in "dietitian_review_flags". You do not compete with the dietitian and you do not blindly obey the dietitian — the combination of both inputs must create the strongest possible clinical nutrition strategy.

QUALITY CONTROL before answering: did you use the client's actual counselling data; respect the regional and household food pattern, allergies, intolerances, medical restrictions, medication timing and training timing; identify the highest-risk eating window; solve the highest-impact problems first without changing too much; retain familiar foods and non-negotiables; personalise protein and carbohydrate; keep the plan practical for the client's cooking facilities, routine and budget; avoid false first-week promises? Final test: does this analysis read like you listened to this specific client for almost an hour? If this exact analysis could apply unchanged to ten other clients, it is NOT personalised enough — reanalyse before answering.

Return ONLY one minified JSON object matching:
${AI_REVIEW_SPEC}
Keep every string under ~30 words so the whole object stays compact.`;

/**
 * Runs the independent clinical review over the full client profile.
 * Never throws for model unavailability at the call site's expense — the
 * caller decides how a failed review is handled.
 */
export async function aiClinicalReview(intake: IntakeForm): Promise<AiReview> {
  const answers = (intake as IntakeForm & { answers?: Answers }).answers;
  const profile = answers
    ? { name: intake.fullName, ...aiProfile(answers) }
    : { name: intake.fullName, intake };

  const messages: ChatMessage[] = [
    { role: "system", content: AI_REVIEW_SYSTEM },
    {
      role: "user",
      content: `Complete client profile and dietitian hypothesis:\n${JSON.stringify(profile, null, 2)}\n\nReturn ONLY the JSON object.`,
    },
  ];
  return generateValidated(messages, AiReviewSchema, "one decision object");
}

export interface PlanContext {
  intake: IntakeForm;
  week: number;
  previousPlan?: DietPlan | null;
  followup?: FollowUpInput | null;
  /** Outcome of the AI first-diet decision engine (week 1). */
  review?: AiReview | null;
  /** Day 1 of the plan (ISO date); defaults to tomorrow. */
  startsOn?: string | null;
  /** Dietitian review round: revise `draft` following written `instructions`. */
  revision?: { draft: DietPlan; instructions: string } | null;
}

/**
 * The decision engine's analysis rendered for the diet-generation prompt.
 * Only sections with content are emitted, so old minimal reviews still work.
 */
function reviewBlock(review: AiReview): string {
  const line = (label: string, v?: string) => (v && v.trim() ? `${label}: ${v.trim()}\n` : "");
  const block = (label: string, items: string[]) =>
    items.length ? `${label}:\n${items.map((s) => `- ${s}`).join("\n")}\n` : "";

  return (
    `\n\nAI FIRST-DIET DECISION ENGINE (analysis already performed — the plan MUST implement it):\n` +
    line("Decision on dietitian hypothesis", review.decision) +
    line("Reasoning", review.reasoning) +
    line("Safety classification", review.safety_classification) +
    line("Client case", review.case_summary) +
    line("Change intensity for this plan", review.change_intensity) +
    block("The three nutrition priorities this plan must solve", review.nutrition_priorities) +
    block("Limiting factors identified", review.limiting_factors) +
    line("Highest-risk eating window (the plan must support it)", review.highest_risk_eating_window) +
    line("Highest-leverage intervention (build it into the plan)", review.highest_leverage_intervention) +
    block("RETAIN — keep these familiar foods/meals/habits in the plan", review.retain) +
    line("Energy strategy", review.energy_strategy) +
    line("Protein strategy", review.protein_strategy) +
    line("Carbohydrate strategy", review.carbohydrate_strategy) +
    line("Fat & cooking strategy", review.fat_cooking_strategy) +
    line("Fibre strategy", review.fibre_strategy) +
    line("Hydration strategy", review.hydration_strategy) +
    line("Training nutrition strategy", review.training_nutrition_strategy) +
    line("Meal architecture to follow", review.meal_architecture) +
    line("Weekend/travel strategy", review.weekend_travel_strategy) +
    block(
      "First-week success indicators (design meals to move these)",
      review.first_week_success_indicators
    ) +
    block("Strategy adjustments to apply", review.strategy_adjustments) +
    block("Safety concerns the plan must respect", review.safety_concerns)
  );
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function dietRules(dietType: string): string {
  switch (dietType) {
    case "vegan":
      return "VEGAN: absolutely no meat, fish, eggs, dairy, honey or any animal product.";
    case "vegetarian":
      return "VEGETARIAN: no meat, no fish, no eggs. Dairy is allowed.";
    case "eggetarian":
      return "EGGETARIAN: vegetarian plus eggs. No meat, no fish.";
    default:
      return "NON-VEGETARIAN: all foods allowed, but keep meat portions sensible.";
  }
}

function compactDays(days: DietPlan["days"]): string {
  return days
    .map(
      (d) =>
        `${d.day}: ${d.meals
          .map((m) => `${m.name}: ${m.items.map((i) => i.food).join(", ")}`)
          .join(" | ")}`
    )
    .join("\n");
}

/**
 * Everything this client must never be served, as the prominent prompt block
 * shared by full-plan generation and single-meal alternatives. Diet-type
 * exclusions (egg for vegetarians, all animal products for vegans, …) sit
 * alongside allergens — the diet-type hard rule alone was not enough to stop
 * "boiled egg" appearing in a vegetarian plan.
 */
function forbiddenBlock(intake: IntakeForm): string {
  const rules = foodRules(intake);
  const forbidden = Array.from(
    new Set([...rules.allergens, ...rules.disliked, ...(DIET_TYPE_TERMS[intake.dietType] ?? [])])
  );
  return forbidden.length
    ? `\n\nFORBIDDEN FOODS — these must NEVER appear in any meal, in any form, dish or preparation (not even as part of a dish name):\n${forbidden
        .map((f) => `- ${f}`)
        .join("\n")}\n`
    : "";
}

function buildSystem(intake: IntakeForm, spec: string, dayRule: string, weeklyNote = ""): string {
  return `You are a senior clinical dietitian creating safe, practical, culturally appropriate diet plans.${forbiddenBlock(intake)}${weeklyNote}

You MUST return ONLY one valid JSON object — no markdown, no code fences, no explanations, no text before or after the JSON. Output MINIFIED JSON on a single line without indentation or unnecessary whitespace.

The JSON must match this exact shape:
${spec}

Hard rules:
1. ${dietRules(intake.dietType)}
2. NEVER include any food the client is allergic or intolerant to, in any form or preparation.
3. NEVER include foods the client dislikes.
4. Prefer foods the client likes and their preferred cuisines where healthy.
5. Adapt the plan to all stated medical conditions (e.g. low-GI for diabetes, low-sodium for hypertension, PCOS-friendly, etc.).
6. ${dayRule}
7. NAME THE ACTUAL DISH — never a bare category. "Sabzi", "Curry", "Salad", "Fruit", "Snack" and "Chutney" on their own are not foods the client can cook or shop for, and they cannot be costed accurately: a lauki sabzi and an aloo sabzi differ several-fold. Write "Bhindi sabzi", "Cucumber tomato salad", "Guava". Keep names short and specific, and use realistic household measures. Every quantity is later re-costed against a food database using these exact weights, so size portions by them: ${PORTION_GUIDE.map(
    (p) => `1 ${p.measure.replace(/^1 /, "")} = ${p.weight}`
  ).join(", ")}. A quantity that reads small will BE small once verified — write the portion this client actually needs to eat.
8. Set "daily_calories" and "macros" from this client's clinical need — body composition, goal, training and medical profile — NEVER from what is easy to reach with their current foods. Do not lower the protein target because the client's usual dal-and-roti pattern would struggle to meet it; change the food pattern instead. When the profile carries "week_1_protein_target_g", that number was measured from the client's own recorded intake during counselling and is FIXED: copy it into "macros".protein_g exactly and build the days to meet it. Do not substitute your own protein figure, and do NOT plan toward "long_term_protein_goal_g" — that is where the client is heading over the following weeks, and pulling it forward into week 1 is the restrictive jump this progression exists to avoid. EVERY meal must include estimated "calories", "protein_g", "carbs_g" and "fat_g" based on standard portion sizes. Meal calories of each day must add up to that day's "total_calories" (within ~5%), close to the daily target. Vary meal times sensibly around the client's schedule.
9. ONE FOOD PER ITEM. Each entry in "items" is a single food with its own quantity — never a sentence describing a whole plate. Write {"food":"Roti","quantity":"2"}, {"food":"Paneer sabzi","quantity":"1 katori"}, {"food":"Curd","quantity":"1 katori"} — NOT {"food":"Whole wheat roti with paneer and vegetable curry"}. Each item is priced separately against the food database, so a multi-food item cannot be costed at all and the whole meal falls back to your own estimate.
10. BE CONCISE: keep "notes" empty unless essential (max 5 words), max 4 items per meal, food names under 5 words.

LeanR Premium diet generation principles — the profile below is a full clinical assessment; use all of it:
11. NEVER generate the diet only from the client's goal, only from the dietitian's selected strategy, only from a calorie calculation, or only from current weight. Generate it from the COMPLETE client profile with independent clinical nutrition reasoning.
12. SAFETY FIRST. Obey every entry under "red_flags" and every doctor instruction — a healthcare professional's restriction overrides everything else. Kidney condition → no generic high-protein plan; respect prescribed protein/fluid/electrolyte limits. Pregnancy/breastfeeding → no calorie deficit or aggressive protocol. Possible disordered eating or restriction-regain history → do NOT intensify restriction; keep the plan permissive and structured. Possible under-fuelling (RED-S signs) → prioritise fuelling and recovery, no deficit.
13. THE DIETITIAN'S STRATEGY IS A PROFESSIONAL HYPOTHESIS ("dietitian_hypothesis"), independently tested by the AI clinical review. Follow the review decision and its strategy adjustments: strengthen a supported strategy, apply the listed modifications, or use the better-supported alternative. Do not compete with the dietitian; do not blindly obey the dietitian.
14. SMALLEST NUMBER OF HIGH-IMPACT CHANGES. The first weekly diet is phase one of a long-term transformation — match the number of changes to "realistic_change_first_2_weeks" and the client's readiness and confidence scores. Preserve foods, meals and routines that are already working.
15. START FROM THE ACTUAL FOOD DAY ("current_food_day" meal timeline). Keep workable meals where they are; change what the review and limiting factors flagged. Meal times must fit wake/work/training/sleep (shift workers get a wake-cycle structure, not a conventional breakfast/lunch/dinner).
16. PROTECT favourite foods, non-negotiables, cultural and household foods where clinically appropriate ("food_rules"). Avoid unnecessary food restriction — do not remove rice or roti by default, and correct (don't reinforce) the client's fear-based food beliefs.
17. AVOID THE CLIENT'S DROPOUT PATTERN ("success_dropout_coaching"): don't trigger the known dropout causes (excess restriction, repetitive food, heavy cooking, unrealistic weekend rules), build on the client's success pattern, and match diet complexity to their preferred structure and portion style.
18. MUSCLE, TRAINING AND RECOVERY: consider muscle preservation, training performance and recovery. Distribute protein across meals (especially breakfast and around training) using sources this client actually accepts, respecting the protein barriers. VERIFIED PROTEIN (from the same database that re-costs this plan — plan by these numbers, not by intuition): ${PROTEIN_REFERENCE.map(
    (p) => `${p.food} ${p.portion} = ${p.protein_g} g`
  ).join("; ")}. Indian staples carry far less protein than they appear to: dal, rice and roti together give barely 10 g per meal, so ENLARGING them cannot reach the daily protein target. Every day must therefore carry several CONCENTRATED sources — curd or milk at breakfast, and paneer/soya/tofu/egg/chicken/fish at each main meal, plus a protein-led snack — sized so the day's meals genuinely sum to the protein target. Reach that target INSIDE the calorie target, by SUBSTITUTION, not addition: protein foods carry calories too, so when you add or enlarge one, reduce refined carbohydrate, oil/ghee and fried items in the same day to compensate. A day that hits its protein target while running over its calorie target has failed both.
19. RESPECT PRACTICAL LIMITS: who cooks, preparation control and capacity, kitchen facilities, budget, limited-access foods, meals the client cannot control, travel and social patterns. Design the diet for the client's ACTUAL life.
20. RETENTION PHILOSOPHY: the first weekly diet is A BETTER VERSION OF THE CLIENT'S REAL DIET unless a clinical, body-composition or fitness-nutrition reason justifies a larger change. Keep roughly 50-70% of the client's familiar food pattern; improve existing meals before replacing them. Never automatically remove rice, roti, dairy, gluten, fruit, carbohydrates or tea; never automatically replace rice with quinoa or roti with millet roti; do not prescribe raw salad to everyone, paneer to every vegetarian, whey to every gym client, or any supplement without a meaningful reason.
21. NO CRASH TACTICS, NO FALSE PROMISES: never use dehydration, extreme carbohydrate restriction, prolonged fasting, meal skipping, detox strategies or nutritionally inadequate intake. In "summary" and "guidelines", never guarantee a specific amount of weight, fat, inch or medical improvement — describe realistic first-week wins (hunger control, fewer cravings, meal consistency, workout energy) instead.
22. FOOD ≠ NUTRITIONAL OBJECTIVE: when the client does not accept a food, keep the OBJECTIVE and use a practical alternative they accept (paneer refused → protein objective via dal/soy/tofu; raw salad refused → cooked vegetables for the fibre/variety objective). Follow "foods_ai_must_not_force", and treat every "ai_hard_constraints" entry in the profile as NON-NEGOTIABLE — second only to a doctor's instruction.
23. THE FINAL TEST: the plan must feel like it was created after listening to this specific client for an hour — "this plan understands my body goal, my food, my training and my life" — never like a generic diet chart with the client's name added. If this exact plan could be given unchanged to ten other clients, it is not personalised enough.`;
}

function profileText(ctx: PlanContext): string {
  const { intake, followup } = ctx;

  // Clients counselled with the LeanR clinical form carry the full assessment
  // in `answers`; older/simpler intakes fall back to the flat fields.
  const answers = (intake as IntakeForm & { answers?: Answers }).answers;
  const profile = answers
    ? { name: intake.fullName, ...aiProfile(answers) }
    : {
        name: intake.fullName,
        age: intake.age,
        gender: intake.gender,
        height_cm: intake.heightCm,
        current_weight_kg: intake.weightKg,
        target_weight_kg: intake.targetWeightKg,
        goal: intake.goal,
        occupation: intake.occupation,
        diet_type: intake.dietType,
        preferred_cuisines: intake.cuisines,
        meals_per_day: intake.mealsPerDay,
        likes: intake.likes,
        dislikes: intake.dislikes,
        allergies: intake.allergies,
        intolerances: intake.intolerances,
        cooking_time_available: intake.cookingTime,
        activity_level: intake.activityLevel,
        exercise: intake.exercise,
        sleep_hours: intake.sleepHours,
        wake_time: intake.wakeTime,
        bed_time: intake.bedTime,
        water_intake_litres: intake.waterIntakeLitres,
        smoking: intake.smoking,
        alcohol: intake.alcohol,
        eating_out_per_week: intake.eatingOutPerWeek,
        work_schedule: intake.workSchedule,
        medical_conditions: intake.conditions,
        medications: intake.medications,
        supplements: intake.supplements,
        digestion_issues: intake.digestion,
        recent_lab_notes: intake.labNotes,
        dietitian_notes: intake.notes,
      };

  let text = JSON.stringify(profile, null, 2);

  if (followup) {
    text += `\n\nThis week's follow-up check-in:\n${JSON.stringify(
      {
        current_weight_kg: followup.weightKg,
        adherence_to_last_plan: followup.adherence,
        energy_level: followup.energyLevel,
        hunger_level: followup.hunger,
        complaints: followup.complaints,
        dietitian_notes: followup.notes,
      },
      null,
      2
    )}\nFollow the LeanR weekly loop: Previous Strategy → Client Execution → Client Feedback → Result → Clinical Interpretation → Updated Strategy → Next Weekly Diet. Adjust the plan based on progress, adherence and complaints.`;
  }

  return text;
}

function extractJson(raw: string): unknown {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("No JSON object found in model response");
  }
  return JSON.parse(text.slice(start, end + 1));
}

class NimError extends Error {
  transient: boolean;
  constructor(message: string, transient: boolean) {
    super(message);
    this.transient = transient;
  }
}

async function callNimOnce(
  messages: ChatMessage[],
  model: string,
  maxTokens = 8192,
  jsonMode = true
): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new NimError("NVIDIA_API_KEY is not configured on the server", false);
  }

  let res: Response;
  try {
    res = await fetch(NIM_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.4,
        top_p: 0.9,
        max_tokens: maxTokens,
        stream: false,
        // Constrained decoding — guarantees syntactically valid JSON on models
        // that support it (schema shape is still validated with Zod after).
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(NIM_TIMEOUT_MS),
    });
  } catch (e) {
    // Timeouts and network failures are transient — worth trying the fallback.
    const reason = e instanceof Error ? e.name || e.message : String(e);
    throw new NimError(`NVIDIA NIM (${model}) unreachable: ${reason}`, true);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Some models reject json mode or cap completion length lower — degrade once.
    if (res.status === 400 && jsonMode && /response_format/i.test(body)) {
      return callNimOnce(messages, model, maxTokens, false);
    }
    if (res.status === 400 && maxTokens > 4096 && /max_tokens/i.test(body)) {
      return callNimOnce(messages, model, 4096, jsonMode);
    }
    throw new NimError(
      `NVIDIA NIM (${model}) failed (${res.status}): ${body.slice(0, 300)}`,
      res.status === 429 || res.status >= 500
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string }; finish_reason?: string }[];
  };
  const choice = data.choices?.[0];
  const content = choice?.message?.content;
  if (!content) throw new NimError(`NVIDIA NIM (${model}) returned an empty response`, true);
  if (choice?.finish_reason === "length") {
    console.warn(
      `NVIDIA NIM (${model}) hit the completion-length cap after ${content.length} chars — output truncated`
    );
  }
  return content;
}

async function callNim(messages: ChatMessage[], model = NIM_MODEL): Promise<string> {
  try {
    return await callNimOnce(messages, model);
  } catch (e) {
    const transient = e instanceof NimError ? e.transient : true;
    if (!transient || model === NIM_FALLBACK_MODEL || NIM_FALLBACK_MODEL === NIM_MODEL) throw e;
    console.warn(
      `Primary model failed (${e instanceof Error ? e.message : e}); ` +
        `falling back to ${NIM_FALLBACK_MODEL}`
    );
    return await callNimOnce(messages, NIM_FALLBACK_MODEL);
  }
}

/**
 * Calls the model and validates the response against a schema, giving the
 * model one corrective retry (validation errors are fed back; truncated
 * responses get a fresh, stronger brevity instruction instead).
 */
async function generateValidated<T>(
  messages: ChatMessage[],
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  expectation: string,
  /** Semantic check on top of the schema (e.g. forbidden foods). */
  check?: (value: T) => string[],
  /**
   * Quality check that triggers a corrective retry but never fails the whole
   * generation (e.g. day calories off target) — on the final attempt the plan
   * is accepted with a warning instead of thrown away.
   */
  softCheck?: (value: T) => string[]
): Promise<T> {
  // A model that keeps truncating or mis-shaping its output usually keeps
  // doing so — once the primary model burns its attempts, the conversation
  // restarts from scratch on the fallback model before giving up.
  const original = messages.slice();
  try {
    return await validatedAttempts(messages, NIM_MODEL, schema, expectation, check, softCheck);
  } catch (e) {
    if (NIM_FALLBACK_MODEL === NIM_MODEL) throw e;
    console.warn(
      `${NIM_MODEL} could not produce a valid response (${e instanceof Error ? e.message : e}); ` +
        `retrying once on ${NIM_FALLBACK_MODEL}`
    );
    // The fallback used to get a single attempt, so one timeout on it turned a
    // recoverable generation into a total failure — four times in one day of
    // testing, each costing the whole plan. A timeout is an infrastructure
    // hiccup, not the model refusing the task, so transient failures here are
    // retried; a genuine "cannot produce a valid plan" is not.
    let lastError: unknown;
    for (let attempt = 1; attempt <= FALLBACK_TRANSIENT_RETRIES + 1; attempt++) {
      try {
        return await validatedAttempts(
          original.slice(),
          NIM_FALLBACK_MODEL,
          schema,
          expectation,
          check,
          softCheck
        );
      } catch (fallbackError) {
        lastError = fallbackError;
        const transient =
          fallbackError instanceof NimError ? fallbackError.transient : false;
        if (!transient || attempt > FALLBACK_TRANSIENT_RETRIES) break;
        const waitMs = FALLBACK_RETRY_BACKOFF_MS * attempt;
        console.warn(
          `${NIM_FALLBACK_MODEL} attempt ${attempt} failed transiently ` +
            `(${fallbackError instanceof Error ? fallbackError.message : fallbackError}); ` +
            `retrying in ${waitMs}ms`
        );
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
    throw lastError;
  }
}

async function validatedAttempts<T>(
  messages: ChatMessage[],
  model: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  expectation: string,
  check?: (value: T) => string[],
  softCheck?: (value: T) => string[]
): Promise<T> {
  let lastError = "";

  for (let attempt = 1; attempt <= 3; attempt++) {
    const content = await callNim(messages, model);

    let json: unknown;
    try {
      json = extractJson(content);
    } catch (e) {
      // Unparseable usually means the output hit the completion-length cap.
      // Echoing the huge broken response back would only make the next attempt
      // longer — retry with a stronger brevity instruction instead.
      lastError = e instanceof Error ? e.message : String(e);
      messages.push(
        { role: "assistant", content: content.slice(0, 200) + " …[cut off]" },
        {
          role: "user",
          content: `Your response was cut off because it was too long. Return the COMPLETE minified JSON again, much more concisely: empty "notes", max 3 items per meal, food names under 4 words. ${expectation}. JSON only.`,
        }
      );
      continue;
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      lastError = parsed.error.issues
        .slice(0, 8)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      console.warn(
        `plan validation attempt ${attempt} (${model}) failed (${lastError}) — ` +
          `response ${content.length} chars, head: ${content.slice(0, 300)}`
      );

      // Constrained JSON decoding can close the object early when the
      // completion cap is hit, so "too few days" is usually truncation in
      // disguise — echoing the huge response back would only make the next
      // attempt longer; demand brevity instead.
      const cutOff = parsed.error.issues.some(
        (i) => i.code === "too_small" && i.path[0] === "days"
      );
      messages.push(
        cutOff
          ? { role: "assistant", content: content.slice(0, 200) + " …[cut off]" }
          : { role: "assistant", content },
        {
          role: "user",
          content: cutOff
            ? `Your response ended before all requested days were included. Return the COMPLETE minified JSON again, much more concisely: empty "notes", max 3 items per meal, food names under 4 words. ${expectation}. JSON only.`
            : `Your previous response was not valid. Problems: ${lastError}. Return the complete corrected minified JSON object only — no other text. ${expectation}.`,
        }
      );
      continue;
    }

    const issues = check?.(parsed.data) ?? [];
    const soft = softCheck?.(parsed.data) ?? [];
    if (issues.length === 0 && soft.length === 0) return parsed.data;
    if (issues.length === 0 && attempt === 3) {
      console.warn(`plan accepted with unresolved quality issues: ${soft.join("; ")}`);
      return parsed.data;
    }

    // Rule violations — name them and demand a corrected plan.
    lastError = [...issues, ...soft].join("; ");
    const fixes = [
      issues.length
        ? `These foods are FORBIDDEN — replace each with a different food the client accepts, keeping the same meal structure and calories.`
        : "",
      soft.length
        ? `Every meal that lists food must have non-zero "calories", "protein_g", "carbs_g" and "fat_g". Adjust portions so each day's meal calories sum to its "total_calories" and land within ~10% of "daily_calories". Name every item as a specific dish, never a bare category: "Bhindi sabzi" not "Sabzi", "Cucumber tomato salad" not "Salad".`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
    messages.push(
      { role: "assistant", content },
      {
        role: "user",
        content:
          `Your plan violates the client's requirements: ${lastError}. ${fixes} ` +
          `Return the complete corrected minified JSON object only. ${expectation}.`,
      }
    );
  }

  throw new Error(`AI (${model}) returned an invalid diet plan after 3 attempts: ${lastError}`);
}

/**
 * Days whose meals add up too far from the daily calorie target (soft check:
 * the model is asked to fix portions, but an off-target plan is still shipped
 * rather than discarded — the dietitian reviews every plan anyway).
 */
// Item names that are a food CATEGORY rather than a food. "Sabzi 1 small bowl"
// tells the client nothing to cook, and it grounds against a generic
// mixed-vegetable row — so the printed macros are an average of dishes whose
// real values differ several-fold (lauki sabzi vs aloo sabzi). The dish has to
// be named. Trim this list if it costs too many regeneration attempts; each
// entry here is a soft issue, so it can never block a plan from shipping.
const CATEGORY_ONLY_NAMES = new Set([
  "sabzi", "sabji", "subzi", "vegetable", "vegetables", "veg", "mixed veg",
  // "Dal" is deliberately absent: it is the commonest item in every plan, a
  // plain dal is a real everyday dish rather than a category, and INDB's
  // "Mixed dal" is a fair measured proxy for it. Flagging it forced a retry on
  // nearly every generation for little accuracy gain.
  "curry", "gravy", "salad", "pulse", "pulses", "legumes",
  "fruit", "fruits", "snack", "snacks", "chutney", "raita", "soup", "juice",
  "nuts", "seeds", "dry fruits", "millet", "cereal", "protein",
]);

/** Meal items named by category instead of by dish. Deduplicated by name. */
function vagueItemIssues(days: DietPlan["days"]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const day of days)
    for (const meal of day.meals)
      for (const item of meal.items) {
        const name = item.food.trim().toLowerCase().replace(/\s+/g, " ");
        if (!CATEGORY_ONLY_NAMES.has(name) || seen.has(name)) continue;
        seen.add(name);
        out.push(
          `"${item.food}" names a food category, not a dish — say which one ` +
            `(e.g. "Bhindi sabzi", "Cucumber tomato salad", "Guava")`
        );
      }
  return out;
}

/** Every soft quality check applied to a generated plan. */
function qualityIssues(days: DietPlan["days"], target: number): string[] {
  return [...calorieIssues(days, target), ...vagueItemIssues(days)];
}

function calorieIssues(days: DietPlan["days"], target: number): string[] {
  const out: string[] = [];
  // A meal that lists food but carries 0 calories is a model omission the
  // schema silently defaulted to 0 (calories/macros fields left out). A day
  // sum can hide it, so name the meal directly and demand its estimate.
  for (const day of days)
    for (const meal of day.meals)
      if (meal.items.length > 0 && (meal.calories || 0) <= 0)
        out.push(`${day.day} "${meal.name}" lists food but has 0 calories — give it realistic "calories" and macros`);
  if (!Number.isFinite(target) || target <= 0) return out;
  for (const day of days) {
    const sum = day.meals.reduce((s, m) => s + (m.calories || 0), 0);
    if (sum > 0 && Math.abs(sum - target) / target > 0.2) {
      out.push(
        `${day.day}'s meals add up to ~${Math.round(sum)} kcal but the daily target is ${Math.round(target)} kcal`
      );
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Forbidden foods. Allergies and dislikes are hard rules, but a model can still
// slip one into a dish name ("Lauki sabzi" for a client who dislikes lauki), so
// they are also enforced deterministically: named back to the model on retry,
// and — for allergens — refused outright rather than shipped.
// ---------------------------------------------------------------------------

/** "Bottle gourd (lauki), karela" -> ["bottle gourd", "lauki", "karela"] */
function splitFoodTerms(raw: string): string[] {
  return (raw || "")
    .split(/[,;\n/]|\band\b/i)
    .flatMap((part) => part.split(/[()]/))
    .map((t) => t.trim().toLowerCase().replace(/^(no|none|nil)$/i, ""))
    // Two-character terms would match inside unrelated words.
    .filter((t) => t.length > 2);
}

interface FoodRules {
  allergens: string[];
  disliked: string[];
}

// THE SAME FOOD UNDER ANOTHER NAME. Groups are symmetric: recording any member
// forbids all of them. A dietitian typed "Brinjal", the model wrote "Baingan
// bharta", the literal substring test matched neither against the other, and a
// plan shipped containing a food the client will not eat. Dislikes AND
// allergens both expand through this, so it is a safety mechanism.
const NAME_ALIASES: string[][] = [
  ["peanut", "groundnut", "moongphali", "moongfali", "singdana"],
  ["brinjal", "baingan", "eggplant", "aubergine"],
  ["mushroom", "khumb", "khumbi"],
  ["bottle gourd", "lauki", "ghiya", "dudhi"],
  ["bitter gourd", "karela"],
  ["ridge gourd", "turai", "tori"],
  ["apple gourd", "tinda"],
  ["okra", "bhindi", "lady finger", "ladies finger"],
  ["spinach", "palak"],
  ["cauliflower", "gobi", "gobhi"],
  ["potato", "aloo", "alu"],
  ["onion", "pyaaz", "pyaz"],
  ["garlic", "lehsun", "lasun"],
  ["fenugreek", "methi"],
  ["curd", "dahi", "yogurt", "yoghurt"],
  ["milk", "doodh", "dudh"],
  ["paneer", "cottage cheese"],
  ["egg", "anda", "omelette", "omelet"],
  ["fish", "machli", "machhli"],
  ["prawn", "shrimp", "jhinga"],
  ["chicken", "murgh", "murga"],
  ["mutton", "goat meat"],
  ["soy", "soya", "soybean"],
  ["wheat", "gehun", "gehu", "atta"],
  ["semolina", "suji", "rava"],
  ["sesame", "til", "tahini", "gingelly"],
  ["cashew", "kaju"],
  ["almond", "badam"],
  ["walnut", "akhrot"],
  ["pistachio", "pista"],
  ["coconut", "nariyal"],
];

// FOODS THAT CONTAIN AN ALLERGEN. Applied to allergens ONLY, never dislikes:
// a milk allergy must rule out paneer and ghee, but a client who merely
// dislikes milk can still eat curd, and expanding a dislike this far would
// strip half the plan for no reason.
const ALLERGEN_DERIVATIVES: Record<string, string[]> = {
  milk: ["paneer", "curd", "dahi", "yogurt", "cheese", "butter", "ghee", "cream", "khoya", "buttermilk", "chaas", "lassi"],
  wheat: ["maida", "suji", "semolina", "rava", "roti", "chapati", "paratha", "bread", "pasta", "noodles", "dalia"],
  soy: ["tofu", "soya chunks", "edamame", "tempeh"],
  peanut: ["peanut butter", "peanut oil", "groundnut oil"],
  egg: ["mayonnaise", "mayo"],
  "tree nut": ["almond", "cashew", "walnut", "pistachio", "hazelnut", "badam", "kaju", "akhrot", "pista"],
  "tree nuts": ["almond", "cashew", "walnut", "pistachio", "hazelnut", "badam", "kaju", "akhrot", "pista"],
};

/** Every other name for the same food, including the term itself. */
export function aliasesOf(term: string): string[] {
  const t = term.toLowerCase().trim();
  const group = NAME_ALIASES.find((g) => g.includes(t));
  return group ? Array.from(new Set([t, ...group])) : [t];
}

/** Aliases only — safe for dislikes, which must not drag in derivatives. */
function withAliases(terms: string[]): string[] {
  const out = new Set<string>();
  for (const t of terms) for (const a of aliasesOf(t)) out.add(a);
  return Array.from(out);
}

/** Aliases plus anything containing the allergen. */
function withAllergenTerms(terms: string[]): string[] {
  const out = new Set(withAliases(terms));
  for (const t of terms)
    for (const alias of aliasesOf(t))
      for (const d of ALLERGEN_DERIVATIVES[alias] ?? []) out.add(d);
  return Array.from(out);
}

/**
 * Whole-word match, tolerating a plural. Substring matching flagged "eggplant"
 * as an egg violation on every vegetarian plan and needed hacks like a trailing
 * space on "til " to stop it matching "lentil"; compound foods that genuinely
 * hide an allergen ("buttermilk") are listed in ALLERGEN_DERIVATIVES instead.
 */
export function mentionsTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}(?:e?s)?\\b`, "i").test(text);
}

function foodRules(intake: IntakeForm): FoodRules {
  return {
    allergens: withAllergenTerms([
      ...splitFoodTerms(intake.allergies),
      ...splitFoodTerms(intake.intolerances),
    ]),
    disliked: withAliases(splitFoodTerms(intake.dislikes)),
  };
}

/** Forbidden terms appearing in the plan's actual meals (not in foods_to_avoid). */
function violations(days: DietPlan["days"], rules: FoodRules): string[] {
  const found = new Map<string, string>();
  for (const day of days) {
    for (const meal of day.meals) {
      // Allergens are scanned across the WHOLE meal — name, notes, items and
      // quantities — a "groundnut oil" note is as unsafe as a peanut item.
      const mealText = [meal.name, meal.notes, ...meal.items.flatMap((i) => [i.food, i.quantity])]
        .join(" · ")
        .toLowerCase();
      for (const term of rules.allergens) {
        if (mentionsTerm(mealText, term))
          found.set(term, `${day.day} ${meal.name} mentions the allergen/intolerance "${term}"`);
      }
      for (const item of meal.items) {
        for (const term of rules.disliked) {
          if (mentionsTerm(item.food, term))
            found.set(term, `"${item.food}" contains the disliked food "${term}"`);
        }
      }
    }
  }
  return Array.from(found.values());
}

/** True when any allergen (not merely a dislike) is still present. */
function hasAllergen(days: DietPlan["days"], rules: FoodRules): boolean {
  return violations(days, { allergens: rules.allergens, disliked: [] }).length > 0;
}

// ---------------------------------------------------------------------------
// Day-of-week food rules (q38a–c) — e.g. no non-veg or eggs on Tuesdays.
// The plan starts tomorrow (same convention as the PDF's date labels), so
// "Day N" maps to a real weekday and restricted weekdays are enforced both in
// the prompt and deterministically on the result.
// ---------------------------------------------------------------------------

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Weekday name for each plan day ("Day 1" = tomorrow unless a start is given). */
export function planWeekdays(startIso?: string | null): string[] {
  const start = startIso ? new Date(startIso) : new Date();
  if (!startIso) start.setDate(start.getDate() + 1);
  return Array.from(
    { length: 7 },
    (_, i) => WEEKDAY_NAMES[new Date(start.getTime() + i * 86_400_000).getDay()]
  );
}

// Foods that identify each avoided category in a meal item's name. Categories
// without a reliable keyword list (fasting grains, "Other") are enforced by
// the prompt only.
const DAY_AVOID_TERMS: Record<string, string[]> = {
  "Non-vegetarian food": [
    "chicken", "fish", "mutton", "prawn", "shrimp", "seafood", "crab", "keema",
    "meat", "lamb", "pork", "beef", "tuna", "salmon",
  ],
  Eggs: ["egg", "omelette", "omelet", "anda"],
  "Onion & garlic": ["onion", "garlic"],
  "All animal products": [
    "chicken", "fish", "mutton", "prawn", "shrimp", "seafood", "crab", "keema",
    "meat", "lamb", "pork", "beef", "egg", "omelette", "omelet", "milk", "curd",
    "dahi", "paneer", "yogurt", "ghee", "butter", "cheese", "buttermilk", "lassi", "honey",
  ],
};

interface DayRules {
  days: string[];
  avoided: string[];
  details: string;
  terms: string[];
}

function weekdayFoodRules(intake: IntakeForm): DayRules | null {
  const answers = (intake as IntakeForm & { answers?: Answers }).answers;
  if (!answers) return null;
  const days = Array.isArray(answers["q38a"]) ? (answers["q38a"] as string[]) : [];
  const avoided = Array.isArray(answers["q38b"]) ? (answers["q38b"] as string[]) : [];
  const details = typeof answers["q38c"] === "string" ? (answers["q38c"] as string) : "";
  if (!days.length || (!avoided.length && !details.trim())) return null;
  const terms = Array.from(new Set(avoided.flatMap((c) => DAY_AVOID_TERMS[c] ?? [])));
  return { days, avoided, details: details.trim(), terms };
}

/** Word-boundary match so "egg" flags "Egg bhurji" but not "Eggplant". */
const matchesTerm = (food: string, term: string) =>
  new RegExp(`\\b${term}s?\\b`, "i").test(food);

// ---------------------------------------------------------------------------
// Diet-type enforcement. "VEGETARIAN: no eggs" is rule 1 of the prompt, but a
// corrective retry ("add breakfast protein") can still slip an egg in — so the
// diet pattern is enforced deterministically like allergens and day rules.
// ---------------------------------------------------------------------------

const DIET_TYPE_TERMS: Record<string, string[]> = {
  vegan: DAY_AVOID_TERMS["All animal products"],
  vegetarian: [...DAY_AVOID_TERMS["Non-vegetarian food"], ...DAY_AVOID_TERMS["Eggs"]],
  eggetarian: DAY_AVOID_TERMS["Non-vegetarian food"],
};

/**
 * Client-facing "foods to avoid": the model tends to echo the whole forbidden
 * block — synonym expansion and diet-type terms included — which turns the PDF
 * section into a page of noise (a vegetarian doesn't need "pork" listed).
 * Keep the client's own typed allergens/intolerances/dislikes plus any other
 * clinical entries the model added; drop synonyms and diet-pattern terms; cap.
 */
function cleanFoodsToAvoid(entries: string[], intake: IntakeForm): string[] {
  const primary = [
    ...splitFoodTerms(intake.allergies),
    ...splitFoodTerms(intake.intolerances),
    ...splitFoodTerms(intake.dislikes),
  ];
  const dietTerms = new Set((DIET_TYPE_TERMS[intake.dietType] ?? []).map((t) => t.toLowerCase()));
  // Expansions of what the dietitian recorded — "baingan" and "eggplant" are
  // the same entry as "brinjal", so the client-facing avoid list shows one of
  // them, not all four.
  const synonymTerms = new Set(
    [...NAME_ALIASES.flat(), ...Object.values(ALLERGEN_DERIVATIVES).flat()].map((s) =>
      s.trim().toLowerCase()
    )
  );

  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of entries) {
    const entry = raw.trim();
    const low = entry.toLowerCase();
    if (!entry || seen.has(low)) continue;
    const isPrimary = primary.some((p) => low === p || low.includes(p));
    if (!isPrimary && (dietTerms.has(low) || synonymTerms.has(low))) continue;
    seen.add(low);
    out.push(entry);
    if (out.length >= 8) break;
  }
  return out;
}

function dietTypeViolations(days: DietPlan["days"], dietType: string): string[] {
  const terms = DIET_TYPE_TERMS[dietType] ?? [];
  const found = new Map<string, string>();
  for (const day of days)
    for (const meal of day.meals)
      for (const item of meal.items)
        for (const t of terms)
          if (matchesTerm(item.food, t))
            found.set(t, `"${item.food}" is not allowed — the client is ${dietType}`);
  return Array.from(found.values());
}

/** Last resort: drop items that break the diet pattern (meal keeps ≥1 item). */
function stripDietTypeViolations(days: DietPlan["days"], dietType: string): DietPlan["days"] {
  const terms = DIET_TYPE_TERMS[dietType] ?? [];
  if (terms.length === 0) return days;
  return days.map((day) => ({
    ...day,
    meals: day.meals.map((meal) => {
      const kept = meal.items.filter((item) => !terms.some((t) => matchesTerm(item.food, t)));
      return kept.length > 0 && kept.length < meal.items.length ? { ...meal, items: kept } : meal;
    }),
  }));
}

function dayRuleViolations(days: DietPlan["days"], dr: DayRules, weekdays: string[]): string[] {
  const found: string[] = [];
  for (const day of days) {
    const idx = parseInt(day.day.replace(/\D+/g, ""), 10);
    const weekday = Number.isFinite(idx) && idx >= 1 && idx <= 7 ? weekdays[idx - 1] : "";
    if (!dr.days.includes(weekday)) continue;
    for (const meal of day.meals)
      for (const item of meal.items)
        if (dr.terms.some((t) => matchesTerm(item.food, t)))
          found.push(
            `${day.day} is a ${weekday} and "${item.food}" is not allowed (client avoids ${dr.avoided.join(", ")} on ${weekday})`
          );
  }
  return found;
}

/** Last resort: drop items that break a weekday rule the model would not fix. */
function stripDayRuleViolations(
  days: DietPlan["days"],
  dr: DayRules,
  weekdays: string[]
): DietPlan["days"] {
  return days.map((day) => {
    const idx = parseInt(day.day.replace(/\D+/g, ""), 10);
    const weekday = Number.isFinite(idx) && idx >= 1 && idx <= 7 ? weekdays[idx - 1] : "";
    if (!dr.days.includes(weekday)) return day;
    return {
      ...day,
      meals: day.meals.map((meal) => {
        const kept = meal.items.filter((item) => !dr.terms.some((t) => matchesTerm(item.food, t)));
        return kept.length > 0 && kept.length < meal.items.length ? { ...meal, items: kept } : meal;
      }),
    };
  });
}

/** Last resort: drop disliked items the model would not remove. */
function stripDisliked(days: DietPlan["days"], rules: FoodRules): DietPlan["days"] {
  return days.map((day) => ({
    ...day,
    meals: day.meals.map((meal) => {
      const kept = meal.items.filter(
        (item) => !rules.disliked.some((t) => item.food.toLowerCase().includes(t))
      );
      // A meal must keep at least one item — if everything was disliked the
      // meal is left as-is and the dietitian edits it.
      return kept.length > 0 && kept.length < meal.items.length ? { ...meal, items: kept } : meal;
    }),
  }));
}

/**
 * Prompt scaffolding every generation step for one plan shares: the decision
 * engine's analysis, the dietitian's revision instructions, the weekday food
 * rules, and the deterministic rule checks. Built once per step so a stepped
 * generation reasons over exactly the same context as a one-shot one.
 */
function planPromptParts(ctx: PlanContext) {
  const { intake, review, revision } = ctx;

  // ---- Outcome of the AI first-diet decision engine, woven into the prompt
  const reviewNote = review ? reviewBlock(review) : "";

  // ---- Dietitian review round: the draft comes back with written change
  // instructions. The dietitian's word is final — the model revises the
  // existing draft instead of inventing a new plan from scratch.
  const revisionNote = revision
    ? `\n\nDIETITIAN REVIEW OF THE PREVIOUS DRAFT — the supervising dietitian reviewed the draft below and requires changes. Their instructions are MANDATORY and override everything except allergies and medical safety. Apply EVERY instruction; keep whatever they did not ask to change as close to the draft as possible.\nDIETITIAN'S INSTRUCTIONS: ${revision.instructions.trim()}\n\nPREVIOUS DRAFT (revise this, do not start over):\nDaily target ~${Math.round(revision.draft.daily_calories)} kcal (protein ${Math.round(revision.draft.macros.protein_g)}g, carbs ${Math.round(revision.draft.macros.carbs_g)}g, fat ${Math.round(revision.draft.macros.fat_g)}g)\n${compactDays(revision.draft.days)}`
    : "";

  // ---- Day-of-week rules (e.g. no non-veg/eggs on Tuesdays)
  const weekdays = planWeekdays(ctx.startsOn);
  const dayRules = weekdayFoodRules(intake);
  const weeklyNote = dayRules
    ? `\n\nWEEKLY DAY-SPECIFIC FOOD RULES (religious/cultural — must be respected exactly):\n` +
      `This plan's calendar: ${weekdays.map((w, i) => `Day ${i + 1} = ${w}`).join(", ")}.\n` +
      `On ${dayRules.days.join(" and ")} the client does NOT consume: ${dayRules.avoided.join(", ")}` +
      (dayRules.details ? ` (${dayRules.details})` : "") +
      `. Meals on those days must contain none of these in any form or dish name — use compliant alternatives with equivalent protein.\n`
    : "";

  const rules = foodRules(intake);
  const checkDays = (days: DietPlan["days"]) => [
    ...violations(days, rules),
    ...dietTypeViolations(days, intake.dietType),
    ...(dayRules ? dayRuleViolations(days, dayRules, weekdays) : []),
  ];

  return { reviewNote, revisionNote, weekdays, dayRules, weeklyNote, rules, checkDays };
}

/**
 * The plan's strategy and daily targets, with no days. Small and quick — the
 * days are then generated against these numbers, a batch per step.
 */
export async function generatePlanOverview(ctx: PlanContext): Promise<PlanOverview> {
  const { intake, week, previousPlan } = ctx;
  const { reviewNote, revisionNote, weeklyNote } = planPromptParts(ctx);

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: buildSystem(
        intake,
        OVERVIEW_SPEC,
        'Return the strategy and daily targets ONLY. Do NOT include a "days" array — the days are requested separately.',
        weeklyNote + reviewNote
      ),
    },
    {
      role: "user",
      content:
        `Set the strategy and daily targets for the Week ${week} diet plan for this client:\n${profileText(ctx)}` +
        (previousPlan
          ? `\n\nLast week's meals (keep what worked, introduce sensible variety):\n${compactDays(previousPlan.days)}`
          : "") +
        revisionNote +
        `\n\nReturn ONLY the JSON object.`,
    },
  ];

  const overview = await generateValidated(
    messages,
    OverviewSchema,
    "the strategy and daily targets, with no days"
  );
  return { ...overview, foods_to_avoid: cleanFoodsToAvoid(overview.foods_to_avoid, intake) };
}

/**
 * One batch of days, built to the overview's targets and aware of the days
 * already planned so the week does not repeat itself. `alreadyPlanned` is
 * every day generated so far, in order.
 */
export async function generatePlanDays(
  ctx: PlanContext,
  overview: PlanOverview,
  names: string[],
  alreadyPlanned: DietPlan["days"]
): Promise<DietPlan["days"]> {
  const { intake, week } = ctx;
  const { reviewNote, revisionNote, weeklyNote, checkDays } = planPromptParts(ctx);

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: buildSystem(
        intake,
        daysSpec(names),
        `"days" must contain EXACTLY ${names.length} entries named ${names
          .map((n) => `"${n}"`)
          .join(" and ")}. The other days of the week are requested separately.`,
        weeklyNote + reviewNote
      ),
    },
    {
      role: "user",
      content:
        `Create ${names.join(" and ")} of the Week ${week} diet plan for this client:\n${profileText(ctx)}` +
        revisionNote +
        `\n\nDaily target: ~${Math.round(overview.daily_calories)} kcal (protein ${Math.round(overview.macros.protein_g)}g, carbs ${Math.round(overview.macros.carbs_g)}g, fat ${Math.round(overview.macros.fat_g)}g). Each of these days must hit that target on its own.` +
        (alreadyPlanned.length
          ? `\n\nAlready planned this week (add variety, do not repeat these menus):\n${compactDays(alreadyPlanned)}`
          : "") +
        `\n\nReturn ONLY the JSON object.`,
    },
  ];

  const result = await generateValidated(
    messages,
    daysSchema(names.length),
    `exactly ${names.length} day(s): ${names.join(", ")}`,
    (p) => checkDays(p.days),
    (p) => qualityIssues(p.days, overview.daily_calories)
  );
  return pickDays(result.days, names);
}

/**
 * Final enforcement over a complete set of days. An allergen surviving the
 * prompt AND its corrective retries is a safety failure, so the plan is
 * refused rather than handed to a client; everything else is stripped.
 */
export function assemblePlan(
  ctx: PlanContext,
  overview: PlanOverview,
  allDays: DietPlan["days"]
): DietPlan {
  const { intake } = ctx;
  const { weekdays, dayRules, rules } = planPromptParts(ctx);

  if (hasAllergen(allDays, rules)) {
    throw new Error(
      "AI could not produce an allergen-safe plan (the client's allergen/intolerance kept appearing). Please regenerate."
    );
  }
  let days = stripDisliked(allDays, rules);
  days = stripDietTypeViolations(days, intake.dietType);
  if (dayRules) days = stripDayRuleViolations(days, dayRules, weekdays);

  return DietPlanSchema.parse({
    ...overview,
    days,
    foods_to_avoid: cleanFoodsToAvoid(overview.foods_to_avoid, intake),
  });
}

/**
 * Generates a complete validated 1-week plan in one call site: the overview,
 * then each day batch in turn. Used by scripts and anywhere not bound by a
 * per-request time limit; the API drives the same functions one step per
 * request so each fits inside the host's function timeout.
 */
export async function generateDietPlan(ctx: PlanContext): Promise<DietPlan> {
  const overview = await generatePlanOverview(ctx);
  const days: DietPlan["days"] = [];
  for (const names of DAY_BATCHES) {
    days.push(...(await generatePlanDays(ctx, overview, names, days)));
  }
  return assemblePlan(ctx, overview, days);
}

// ---------------------------------------------------------------------------
// Per-meal alternatives (the pencil menu on the draft preview).
// The dietitian opens ONE meal and asks for swap-in choices for that slot. One
// short model call, not a plan regeneration: the dietitian is waiting on it,
// and the other six days must not move because they changed Tuesday's lunch.
// Every rule that constrains a plan constrains an alternative — allergens,
// dislikes, diet type and the weekday (q38) rules are enforced on the way in
// and again on the way out.
// ---------------------------------------------------------------------------

const ALTERNATES_SPEC = `{
  "alternates": [
    {
      "items": [ { "food": string, "quantity": string } ],  // 1-4 items, ONE food each
      "notes": string,                                      // usually "", max 5 words
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number
    }
  ]
}`;

const AlternatesSchema = z.object({
  alternates: z.array(MealAlternateSchema).min(1),
});

/** Calorie band an alternative must land in to be interchangeable with the meal. */
const ALTERNATE_KCAL_TOLERANCE = 0.25;

export interface MealAlternatesContext {
  intake: IntakeForm;
  week: number;
  plan: DietPlan;
  dayIndex: number;
  mealIndex: number;
  /** Day 1 of the plan, so weekday food rules apply to the right day. */
  startsOn?: string | null;
  /** How many options to ask for (1-6, default 4). */
  count?: number;
}

function buildAlternatesSystem(intake: IntakeForm, weeklyNote: string): string {
  return `You are a senior clinical dietitian. A supervising dietitian is reviewing a draft weekly diet and wants alternative options for ONE meal, so the client can choose between them on the day.${forbiddenBlock(intake)}${weeklyNote}

You MUST return ONLY one valid JSON object — no markdown, no code fences, no explanations, no text before or after the JSON. Output MINIFIED JSON on a single line.

The JSON must match this exact shape:
${ALTERNATES_SPEC}

Hard rules:
1. ${dietRules(intake.dietType)}
2. NEVER include a food the client is allergic or intolerant to, in any form or preparation, and never a food they dislike.
3. Every alternative REPLACES the given meal — same occasion, same eating window. It must land within 10% of that meal's calories and carry AT LEAST as much protein. These are interchangeable choices, NOT extra food and NOT a lighter option.
4. Each alternative is a COMPLETE meal the client can cook and eat, not a single-ingredient swap.
5. ONE FOOD PER ITEM, each with its own quantity: {"food":"Roti","quantity":"2"}, {"food":"Paneer bhurji","quantity":"1 katori"} — never a sentence describing a whole plate. Max 4 items per alternative.
6. NAME THE ACTUAL DISH, never a bare category — "Bhindi sabzi" not "Sabzi", "Cucumber tomato salad" not "Salad". Food names under 5 words.
7. Every quantity is re-costed against a food database using these household weights, so size portions by them: ${PORTION_GUIDE.map(
    (p) => `1 ${p.measure.replace(/^1 /, "")} = ${p.weight}`
  ).join(", ")}. VERIFIED PROTEIN (plan by these numbers, not by intuition): ${PROTEIN_REFERENCE.map(
    (p) => `${p.food} ${p.portion} = ${p.protein_g} g`
  ).join("; ")}.
8. Each alternative must be genuinely DIFFERENT from the original meal AND from the other alternatives — a different main dish and, where possible, a different protein source. The same meal with one item changed is not an alternative.
9. Stay inside this client's real life: their cuisine, cooking time, budget, kitchen access and the foods they already like. Do not introduce exotic or expensive foods to look varied.
10. Keep "notes" empty unless essential (max 5 words).`;
}

const itemLine = (items: MealAlternate["items"]) =>
  items.map((i) => (i.quantity ? `${i.food} (${i.quantity})` : i.food)).join(", ");

/**
 * Everything wrong with serving these meals on day `dayIndex` of this plan:
 * allergens, disliked foods, diet pattern and the client's weekday (q38) food
 * rules. An empty result means they are safe to store.
 *
 * Applied when alternatives are generated AND again when the dietitian swaps
 * one into the plan — the meal arrives back from the browser, which is never
 * trusted with the client's allergen list.
 */
export function mealRuleIssues(args: {
  intake: IntakeForm;
  plan: DietPlan;
  dayIndex: number;
  meals: PlanMeal[];
  startsOn?: string | null;
}): string[] {
  const { blocking, warnings } = mealRuleReport(args);
  return [...blocking, ...warnings];
}

/**
 * The same rules, split by who is allowed to overrule them.
 *
 * `blocking` — an allergen/intolerance, or a food outside the client's diet
 * pattern. Never overridable: rule 1 of the whole system is that a documented
 * allergy outranks everyone, the dietitian included.
 *
 * `warnings` — a disliked food or a weekday (q38) rule. These are preferences
 * and observances, and the supervising dietitian is the authority on them:
 * when they type a meal by hand they may have a reason the form never
 * captured, so these are shown and consciously confirmed rather than refused.
 *
 * AI-generated options are held to BOTH (see mealRuleIssues) — the model gets
 * no such benefit of the doubt.
 */
export function mealRuleReport({
  intake,
  plan,
  dayIndex,
  meals,
  startsOn,
}: {
  intake: IntakeForm;
  plan: DietPlan;
  dayIndex: number;
  meals: PlanMeal[];
  startsOn?: string | null;
}): { blocking: string[]; warnings: string[] } {
  const day = plan.days[dayIndex];
  if (!day) return { blocking: ["That day is not part of this plan"], warnings: [] };
  const weekdays = planWeekdays(startsOn);
  const dayRules = weekdayFoodRules(intake);
  const rules = foodRules(intake);
  // Every checker reads a day's worth of meals, so the meals under test are
  // presented as that day — same rules, same wording as plan generation.
  const days: DietPlan["days"] = [{ ...day, meals }];
  return {
    blocking: [
      ...violations(days, { allergens: rules.allergens, disliked: [] }),
      ...dietTypeViolations(days, intake.dietType),
    ],
    warnings: [
      ...violations(days, { allergens: [], disliked: rules.disliked }),
      ...(dayRules ? dayRuleViolations(days, dayRules, weekdays) : []),
    ],
  };
}

/** Identity of a meal by its foods, so duplicates can be dropped. */
const alternateKey = (items: MealAlternate["items"]) =>
  items
    .map((i) => i.food.trim().toLowerCase())
    .sort()
    .join(" | ");

/**
 * Generates swap-in options for a single meal of a draft plan. The returned
 * alternatives carry the model's own macro estimates — callers ground them
 * against the foods table before showing or storing them.
 */
export async function generateMealAlternates(
  ctx: MealAlternatesContext
): Promise<MealAlternate[]> {
  const { intake, plan, dayIndex, mealIndex } = ctx;
  const day = plan.days[dayIndex];
  const meal = day?.meals[mealIndex];
  if (!day || !meal) throw new Error("That meal is not part of this plan");

  const count = Math.min(Math.max(ctx.count ?? 4, 1), 6);

  // ---- Weekday rules for THIS day only (e.g. no non-veg on a Tuesday)
  const weekdays = planWeekdays(ctx.startsOn);
  const dayRules = weekdayFoodRules(intake);
  const dayNumber = parseInt(day.day.replace(/\D+/g, ""), 10);
  const weekday =
    Number.isFinite(dayNumber) && dayNumber >= 1 && dayNumber <= 7 ? weekdays[dayNumber - 1] : "";
  const restricted = dayRules?.days.includes(weekday) ?? false;
  const weeklyNote =
    dayRules && restricted
      ? `\n\nDAY-SPECIFIC FOOD RULE (religious/cultural — must be respected exactly):\n` +
        `This meal falls on a ${weekday}, when the client does NOT consume: ${dayRules.avoided.join(", ")}` +
        (dayRules.details ? ` (${dayRules.details})` : "") +
        `. No alternative may contain any of these in any form or dish name — use compliant options with equivalent protein.\n`
      : "";

  const kcal = Math.round(meal.calories || 0);
  const protein = Math.round(meal.protein_g || 0);
  const otherMeals = day.meals
    .filter((_, i) => i !== mealIndex)
    .map((m) => `${m.name}: ${itemLine(m.items)}`)
    .join("\n");
  const weekDishes = Array.from(
    new Set(
      plan.days.flatMap((d, di) =>
        d.meals.flatMap((m, mi) =>
          di === dayIndex && mi === mealIndex ? [] : m.items.map((i) => i.food.trim())
        )
      )
    )
  ).join(", ");

  const messages: ChatMessage[] = [
    { role: "system", content: buildAlternatesSystem(intake, weeklyNote) },
    {
      role: "user",
      content:
        `Client profile:\n${profileText({ intake, week: ctx.week })}\n\n` +
        `Give exactly ${count} alternative options for this ONE meal of the Week ${ctx.week} plan.\n\n` +
        `MEAL: ${day.day}${weekday ? ` (${weekday})` : ""} — ${meal.name}${meal.time ? ` at ${meal.time}` : ""}\n` +
        `Currently: ${itemLine(meal.items)}\n` +
        (kcal > 0
          ? `Its macros: ${kcal} kcal, protein ${protein} g, carbs ${Math.round(meal.carbs_g || 0)} g, fat ${Math.round(meal.fat_g || 0)} g.\n` +
            `Every alternative must land near ${kcal} kcal with at least ${protein} g protein.\n`
          : "") +
        (meal.alternates.length
          ? `\nAlready offered as alternatives for this meal (do not repeat these):\n${meal.alternates
              .map((a) => itemLine(a.items))
              .join("\n")}\n`
          : "") +
        (otherMeals ? `\nThe rest of ${day.day} (do not duplicate these meals):\n${otherMeals}\n` : "") +
        (weekDishes ? `\nFoods already used elsewhere this week — prefer something else:\n${weekDishes}\n` : "") +
        `\nReturn ONLY the JSON object.`,
    },
  ];

  const breaksRules = (alternates: MealAlternate[]) =>
    mealRuleIssues({
      intake,
      plan,
      dayIndex,
      meals: alternates.map((a) => ({ ...meal, ...a })),
      startsOn: ctx.startsOn,
    });

  const result = await generateValidated(
    messages,
    AlternatesSchema,
    `exactly ${count} alternatives for the one meal`,
    (v) => breaksRules(v.alternates),
    (v) =>
      kcal > 0
        ? v.alternates
            .filter(
              (a) => Math.abs((a.calories || 0) - kcal) > ALTERNATE_KCAL_TOLERANCE * kcal
            )
            .map(
              (a) =>
                `"${itemLine(a.items)}" is ${Math.round(a.calories || 0)} kcal — the meal it replaces is ${kcal} kcal`
            )
        : []
  );

  // Belt and braces, per option: a single unsafe alternative is dropped rather
  // than failing the whole request, and near-duplicates of the meal it would
  // replace are worthless as a choice.
  const seen = new Set([
    alternateKey(meal.items),
    ...meal.alternates.map((a) => alternateKey(a.items)),
  ]);
  const safe: MealAlternate[] = [];
  for (const alternate of result.alternates) {
    if (breaksRules([alternate]).length > 0) continue;
    const key = alternateKey(alternate.items);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    safe.push(alternate);
    if (safe.length === count) break;
  }

  if (safe.length === 0) {
    throw new Error(
      "The AI could not produce a safe, different alternative for this meal — try again, or use the change instructions box."
    );
  }
  return safe;
}

// ---------------------------------------------------------------------------
// The dietitian's own meal, typed in their own words.
// When none of the generated options fit, they write the meal themselves
// ("2 roti, paneer bhurji 1 katori, curd and a salad") and the model's ONLY
// job is to structure it — one food per item, with the household quantity the
// grounding math understands. It must not invent, substitute or drop food:
// the macros are then computed from the foods table, not guessed, so a
// dietitian who writes their own meal still gets real protein/calorie numbers.
// ---------------------------------------------------------------------------

const PARSED_MEAL_SPEC = `{
  "items": [ { "food": string, "quantity": string } ],  // ONE food each, max 8
  "notes": string                                        // "" unless the dietitian wrote an instruction
}`;

const ParsedMealSchema = z.object({
  items: z.array(MealItemSchema).min(1).max(8),
  notes: z.string().default(""),
});

// Words that qualify a food rather than name one, so a coverage check does not
// demand them back. Household measures come from the same list the grounding
// math uses; the rest are quantifiers and filler.
const NON_FOOD_WORDS = new Set([
  "katori", "bowl", "bowls", "cup", "cups", "glass", "glasses", "plate", "plates",
  "tbsp", "tsp", "spoon", "spoons", "grams", "gram", "piece", "pieces", "slice",
  "slices", "handful", "small", "medium", "large", "half", "quarter", "some",
  "with", "and", "plus", "each", "one", "two", "three", "four", "five", "little",
]);

// A phrase that instructs rather than names a food ("no oil", "less salt") —
// it belongs in notes, so it must never be demanded back as an item.
const INSTRUCTION_PHRASE =
  /^\s*(no|not|without|avoid|skip|less|low|extra|only|keep|make|use|cook|eat|prefer)\b/i;

/**
 * The foods the dietitian appears to have written, for checking the parse gave
 * them all back. Deliberately crude and forgiving: it drives a corrective
 * retry, never a rejection, because the dietitian sees the parsed items before
 * anything is applied and is the real check.
 */
function writtenFoodWords(text: string): string[] {
  return text
    .split(/[,;\n+]|\band\b|\bwith\b/i)
    .filter((phrase) => phrase.trim().length > 2 && !INSTRUCTION_PHRASE.test(phrase))
    .flatMap((phrase) =>
      phrase
        .toLowerCase()
        .replace(/[^a-z\s]/g, " ")
        .split(/\s+/)
        // 4+ letters keeps this conservative: it can miss a dropped "egg",
        // which the dietitian will see, but it will not invent a complaint.
        .filter((w) => w.length >= 4 && !NON_FOOD_WORDS.has(w))
    );
}

/**
 * Structures a dietitian's free-text meal into priceable items. Returns the
 * items only — macros stay at zero for the caller to fill from the foods
 * table, because the whole point is that these numbers are measured.
 */
export async function parseMealText(ctx: {
  intake: IntakeForm;
  text: string;
  mealName: string;
}): Promise<MealAlternate> {
  const text = ctx.text.trim();
  if (!text) throw new Error("Write the meal first");

  const system = `You convert a dietitian's handwritten meal note into structured data. You are a PARSER, not a planner.

You MUST return ONLY one valid JSON object — no markdown, no code fences, no commentary. Output MINIFIED JSON on a single line.

The JSON must match this exact shape:
${PARSED_MEAL_SPEC}

Hard rules:
1. NEVER invent, add, remove, substitute or "improve" a food. Every item you return must be a food the dietitian actually wrote. If they wrote three foods, return exactly those three.
2. ONE FOOD PER ITEM. "2 roti with dal and curd" becomes three items: Roti (2), Dal (1 katori), Curd (1 katori) — never one item describing the plate.
3. Keep the dietitian's own quantity whenever they gave one, rewritten in a standard household form: "2", "1 katori", "150 g", "1 cup", "1 glass", "1 bowl".
4. When they gave NO quantity for a food, fill in the ordinary single serving of that dish for one adult — never leave a quantity empty, and never guess large.
5. These are the weights every quantity is re-costed against, so choose units from this list wherever they fit: ${PORTION_GUIDE.map(
    (p) => `1 ${p.measure.replace(/^1 /, "")} = ${p.weight}`
  ).join(", ")}.
6. Write each food as the specific dish, in title case, under 5 words: "Paneer bhurji", "Cucumber tomato salad". Expand obvious shorthand to the dish the dietitian means ("bhurji" -> "Paneer bhurji" only if they wrote paneer; otherwise keep it as written).
7. "notes" stays "" unless the dietitian wrote an actual instruction (e.g. "no oil", "eat by 8pm"). Never put food in notes.`;

  // Dropping a food the dietitian wrote is the failure that matters — an 8B
  // model turned "idli sambar and coconut chutney" into "Idli" alone. This is
  // a SOFT check: it buys a corrective retry, and on the last attempt the
  // parse still ships, because the dietitian reviews the items on screen
  // before applying and a refusal would just strand them.
  const expected = writtenFoodWords(text);
  const missingFoods = (v: z.infer<typeof ParsedMealSchema>) => {
    const got = v.items.map((i) => i.food.toLowerCase()).join(" | ");
    const dropped = Array.from(new Set(expected.filter((w) => !got.includes(w))));
    return dropped.length
      ? [`you left out what the dietitian wrote: ${dropped.join(", ")}`]
      : [];
  };

  const parsed = await generateValidated(
    [
      { role: "system", content: system },
      {
        role: "user",
        content:
          `Meal slot: ${ctx.mealName}\n` +
          `The dietitian wrote:\n"""\n${text}\n"""\n\n` +
          `Return ONLY the JSON object with each food they wrote as its own item.`,
      },
    ],
    ParsedMealSchema,
    "one object with the foods the dietitian wrote",
    undefined,
    missingFoods
  );

  const dropped = missingFoods(parsed);
  if (dropped.length > 0) {
    console.warn(`parseMealText: ${dropped[0]} — text: "${text}"`);
  }

  return {
    // Rule 4 of the prompt says every item carries a portion; a small model
    // ignores it often enough that the guarantee belongs in code. "1 serving"
    // resolves to the food's own serving weight during grounding, so an
    // unquantified item is still priced instead of silently counting as zero.
    items: parsed.items.map((i) => ({
      food: i.food.trim(),
      quantity: i.quantity.trim() || "1 serving",
    })),
    notes: parsed.notes,
    // Deliberately zero — groundMeals() fills these from the foods table. A
    // model-guessed calorie count is exactly what this feature exists to avoid.
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
  };
}

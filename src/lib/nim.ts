import { z } from "zod";
import type { FollowUpInput, IntakeForm } from "./types";
import { aiProfile } from "./counselling/assessment";
import type { Answers } from "./counselling/questions";

// ---------------------------------------------------------------------------
// Strict plan schema — everything the model returns is validated against this.
// ---------------------------------------------------------------------------

const MealItemSchema = z.object({
  food: z.string(),
  quantity: z.string().default(""),
});

const MealSchema = z.object({
  name: z.string(),
  time: z.string().default(""),
  items: z.array(MealItemSchema).min(1),
  notes: z.string().default(""),
  calories: z.number().default(0),
  protein_g: z.number().default(0),
  carbs_g: z.number().default(0),
  fat_g: z.number().default(0),
});

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

// The plan is generated in two halves — the shared NIM serving functions cap
// completions around ~2k tokens, and a full 7-day plan with per-meal macros
// doesn't fit. Each half fits comfortably. Models sometimes return more days
// than asked (e.g. echoing all 7 in the second call), so the count is a
// minimum and pickDays() selects the ones that were requested.
const PartOneSchema = DietPlanSchema.extend({
  days: z.array(DaySchema).min(4),
});
const PartTwoSchema = z.object({
  days: z.array(DaySchema).min(3),
});

/** Select (and rename) the requested days from a possibly over-long answer. */
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
const NIM_TIMEOUT_MS = 120_000;

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

const PART_ONE_SPEC = `{
  "summary": string,                  // 2-3 sentence overview of the plan strategy for this client
  "daily_calories": number,           // target kcal/day
  "macros": { "protein_g": number, "carbs_g": number, "fat_g": number },
  "guidelines": string[],             // max 5 short practical rules (max 12 words each)
  "hydration": string,                // daily water guidance
  "days": [                           // EXACTLY 4 entries: "Day 1" .. "Day 4"
    ${DAY_SPEC}
  ],
  "foods_to_avoid": string[]          // max 6 short entries
}`;

const PART_TWO_SPEC = `{
  "days": [                           // EXACTLY 3 entries: "Day 5", "Day 6", "Day 7"
    ${DAY_SPEC}
  ]
}`;

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

function buildSystem(intake: IntakeForm, spec: string, dayRule: string, weeklyNote = ""): string {
  const rules = foodRules(intake);
  const forbidden = Array.from(new Set([...rules.allergens, ...rules.disliked]));
  const forbiddenBlock = forbidden.length
    ? `\n\nFORBIDDEN FOODS — these must NEVER appear in any meal, in any form, dish or preparation (not even as part of a dish name):\n${forbidden
        .map((f) => `- ${f}`)
        .join("\n")}\n`
    : "";

  return `You are a senior clinical dietitian creating safe, practical, culturally appropriate diet plans.${forbiddenBlock}${weeklyNote}

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
7. Keep food names and quantities short and specific. Use realistic household measures.
8. EVERY meal must include estimated "calories", "protein_g", "carbs_g" and "fat_g" based on standard portion sizes. Meal calories of each day must add up to that day's "total_calories" (within ~5%), close to the daily target. Vary meal times sensibly around the client's schedule.
9. BE CONCISE: keep "notes" empty unless essential (max 5 words), max 4 items per meal, food names under 5 words.

LeanR Premium diet generation principles — the profile below is a full clinical assessment; use all of it:
10. NEVER generate the diet only from the client's goal, only from the dietitian's selected strategy, only from a calorie calculation, or only from current weight. Generate it from the COMPLETE client profile with independent clinical nutrition reasoning.
11. SAFETY FIRST. Obey every entry under "red_flags" and every doctor instruction — a healthcare professional's restriction overrides everything else. Kidney condition → no generic high-protein plan; respect prescribed protein/fluid/electrolyte limits. Pregnancy/breastfeeding → no calorie deficit or aggressive protocol. Possible disordered eating or restriction-regain history → do NOT intensify restriction; keep the plan permissive and structured. Possible under-fuelling (RED-S signs) → prioritise fuelling and recovery, no deficit.
12. THE DIETITIAN'S STRATEGY IS A PROFESSIONAL HYPOTHESIS ("dietitian_hypothesis"), independently tested by the AI clinical review. Follow the review decision and its strategy adjustments: strengthen a supported strategy, apply the listed modifications, or use the better-supported alternative. Do not compete with the dietitian; do not blindly obey the dietitian.
13. SMALLEST NUMBER OF HIGH-IMPACT CHANGES. The first weekly diet is phase one of a long-term transformation — match the number of changes to "realistic_change_first_2_weeks" and the client's readiness and confidence scores. Preserve foods, meals and routines that are already working.
14. START FROM THE ACTUAL FOOD DAY ("current_food_day" meal timeline). Keep workable meals where they are; change what the review and limiting factors flagged. Meal times must fit wake/work/training/sleep (shift workers get a wake-cycle structure, not a conventional breakfast/lunch/dinner).
15. PROTECT favourite foods, non-negotiables, cultural and household foods where clinically appropriate ("food_rules"). Avoid unnecessary food restriction — do not remove rice or roti by default, and correct (don't reinforce) the client's fear-based food beliefs.
16. AVOID THE CLIENT'S DROPOUT PATTERN ("success_dropout_coaching"): don't trigger the known dropout causes (excess restriction, repetitive food, heavy cooking, unrealistic weekend rules), build on the client's success pattern, and match diet complexity to their preferred structure and portion style.
17. MUSCLE, TRAINING AND RECOVERY: consider muscle preservation, training performance and recovery. Distribute protein across meals (especially breakfast and around training) using sources this client actually accepts, respecting the protein barriers.
18. RESPECT PRACTICAL LIMITS: who cooks, preparation control and capacity, kitchen facilities, budget, limited-access foods, meals the client cannot control, travel and social patterns. Design the diet for the client's ACTUAL life.
19. RETENTION PHILOSOPHY: the first weekly diet is A BETTER VERSION OF THE CLIENT'S REAL DIET unless a clinical, body-composition or fitness-nutrition reason justifies a larger change. Keep roughly 50-70% of the client's familiar food pattern; improve existing meals before replacing them. Never automatically remove rice, roti, dairy, gluten, fruit, carbohydrates or tea; never automatically replace rice with quinoa or roti with millet roti; do not prescribe raw salad to everyone, paneer to every vegetarian, whey to every gym client, or any supplement without a meaningful reason.
20. NO CRASH TACTICS, NO FALSE PROMISES: never use dehydration, extreme carbohydrate restriction, prolonged fasting, meal skipping, detox strategies or nutritionally inadequate intake. In "summary" and "guidelines", never guarantee a specific amount of weight, fat, inch or medical improvement — describe realistic first-week wins (hunger control, fewer cravings, meal consistency, workout energy) instead.
21. FOOD ≠ NUTRITIONAL OBJECTIVE: when the client does not accept a food, keep the OBJECTIVE and use a practical alternative they accept (paneer refused → protein objective via dal/soy/tofu; raw salad refused → cooked vegetables for the fibre/variety objective). Follow "foods_ai_must_not_force", and treat every "ai_hard_constraints" entry in the profile as NON-NEGOTIABLE — second only to a doctor's instruction.
22. THE FINAL TEST: the plan must feel like it was created after listening to this specific client for an hour — "this plan understands my body goal, my food, my training and my life" — never like a generic diet chart with the client's name added. If this exact plan could be given unchanged to ten other clients, it is not personalised enough.`;
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
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new NimError(`NVIDIA NIM (${model}) returned an empty response`, true);
  return content;
}

async function callNim(messages: ChatMessage[]): Promise<string> {
  try {
    return await callNimOnce(messages, NIM_MODEL);
  } catch (e) {
    const transient = e instanceof NimError ? e.transient : true;
    if (!transient || NIM_FALLBACK_MODEL === NIM_MODEL) throw e;
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
  let lastError = "";

  for (let attempt = 1; attempt <= 3; attempt++) {
    const content = await callNim(messages);

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

      messages.push(
        { role: "assistant", content },
        {
          role: "user",
          content: `Your previous response was not valid. Problems: ${lastError}. Return the complete corrected minified JSON object only — no other text. ${expectation}.`,
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
        ? `Adjust meal portions and items so every day's meal calories sum to its "total_calories" and land within ~10% of "daily_calories".`
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

  throw new Error(`AI returned an invalid diet plan after 3 attempts: ${lastError}`);
}

/**
 * Days whose meals add up too far from the daily calorie target (soft check:
 * the model is asked to fix portions, but an off-target plan is still shipped
 * rather than discarded — the dietitian reviews every plan anyway).
 */
function calorieIssues(days: DietPlan["days"], target: number): string[] {
  if (!Number.isFinite(target) || target <= 0) return [];
  const out: string[] = [];
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

// Indian-English/Hindi names and common aliases for allergens. "Peanut" typed
// by the dietitian must also forbid "groundnut sabzi" — the model uses these
// names interchangeably, so the safety scan must too.
const ALLERGEN_SYNONYMS: Record<string, string[]> = {
  peanut: ["groundnut", "moongphali", "moongfali", "singdana"],
  groundnut: ["peanut", "moongphali", "moongfali", "singdana"],
  milk: ["doodh"],
  curd: ["dahi", "yogurt", "yoghurt"],
  egg: ["anda", "omelette", "omelet"],
  wheat: ["atta", "gehun"],
  soy: ["soya", "tofu"],
  sesame: ["til ", "tahini", "gingelly"],
  "tree nut": ["almond", "cashew", "walnut", "pistachio", "hazelnut", "badam", "kaju", "akhrot", "pista"],
  "tree nuts": ["almond", "cashew", "walnut", "pistachio", "hazelnut", "badam", "kaju", "akhrot", "pista"],
};

/** Expands allergen terms with their known synonyms. */
function withSynonyms(terms: string[]): string[] {
  const out = new Set(terms);
  for (const t of terms) for (const syn of ALLERGEN_SYNONYMS[t] ?? []) out.add(syn);
  return Array.from(out);
}

function foodRules(intake: IntakeForm): FoodRules {
  return {
    allergens: withSynonyms([
      ...splitFoodTerms(intake.allergies),
      ...splitFoodTerms(intake.intolerances),
    ]),
    disliked: splitFoodTerms(intake.dislikes),
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
        if (mealText.includes(term))
          found.set(term, `${day.day} ${meal.name} mentions the allergen/intolerance "${term}"`);
      }
      for (const item of meal.items) {
        const food = item.food.toLowerCase();
        for (const term of rules.disliked) {
          if (food.includes(term)) found.set(term, `"${item.food}" contains the disliked food "${term}"`);
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

/** Weekday name for each plan day ("Day 1" = tomorrow). */
export function planWeekdays(): string[] {
  const start = new Date();
  start.setDate(start.getDate() + 1);
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
 * Generates a validated 1-week diet plan in two model calls (overview + days
 * 1-4, then days 5-7) so each response stays within the completion-length
 * limits of NVIDIA's shared NIM endpoints.
 */
export async function generateDietPlan(ctx: PlanContext): Promise<DietPlan> {
  const { intake, week, previousPlan, review } = ctx;

  // ---- Outcome of the AI first-diet decision engine, woven into the prompt
  const reviewNote = review ? reviewBlock(review) : "";

  // ---- Day-of-week rules (e.g. no non-veg/eggs on Tuesdays)
  const weekdays = planWeekdays();
  const dayRules = weekdayFoodRules(intake);
  const weeklyNote = dayRules
    ? `\n\nWEEKLY DAY-SPECIFIC FOOD RULES (religious/cultural — must be respected exactly):\n` +
      `This plan's calendar: ${weekdays.map((w, i) => `Day ${i + 1} = ${w}`).join(", ")}.\n` +
      `On ${dayRules.days.join(" and ")} the client does NOT consume: ${dayRules.avoided.join(", ")}` +
      (dayRules.details ? ` (${dayRules.details})` : "") +
      `. Meals on those days must contain none of these in any form or dish name — use compliant alternatives with equivalent protein.\n`
    : "";

  // ---- Part 1: plan overview + days 1-4
  const partOneMessages: ChatMessage[] = [
    {
      role: "system",
      content: buildSystem(
        intake,
        PART_ONE_SPEC,
        '"days" must contain EXACTLY 4 entries named "Day 1" through "Day 4" (days 5-7 are requested separately).',
        weeklyNote + reviewNote
      ),
    },
    {
      role: "user",
      content:
        `Create the overview and days 1-4 of the Week ${week} diet plan for this client:\n${profileText(ctx)}` +
        (previousPlan
          ? `\n\nLast week's meals (keep what worked, introduce sensible variety, do not repeat the exact same menu):\n${compactDays(previousPlan.days)}`
          : "") +
        `\n\nReturn ONLY the JSON object.`,
    },
  ];
  const rules = foodRules(intake);
  const checkDays = (days: DietPlan["days"]) => [
    ...violations(days, rules),
    ...dietTypeViolations(days, intake.dietType),
    ...(dayRules ? dayRuleViolations(days, dayRules, weekdays) : []),
  ];
  const partOne = await generateValidated(
    partOneMessages,
    PartOneSchema,
    'at least 4 days ("Day 1" to "Day 4")',
    (p) => checkDays(p.days),
    (p) => calorieIssues(p.days, p.daily_calories)
  );
  partOne.days = pickDays(partOne.days, ["Day 1", "Day 2", "Day 3", "Day 4"]);

  // ---- Part 2: days 5-7, aware of days 1-4 for variety
  const partTwoMessages: ChatMessage[] = [
    {
      role: "system",
      content: buildSystem(
        intake,
        PART_TWO_SPEC,
        '"days" must contain EXACTLY 3 entries named "Day 5", "Day 6" and "Day 7".',
        weeklyNote + reviewNote
      ),
    },
    {
      role: "user",
      content:
        `Create days 5-7 of the Week ${week} diet plan for this client:\n${profileText(ctx)}` +
        `\n\nDaily target: ~${Math.round(partOne.daily_calories)} kcal (protein ${Math.round(partOne.macros.protein_g)}g, carbs ${Math.round(partOne.macros.carbs_g)}g, fat ${Math.round(partOne.macros.fat_g)}g).` +
        `\n\nDays 1-4 already planned (add variety, do not repeat the same menus):\n${compactDays(partOne.days)}` +
        `\n\nReturn ONLY the JSON object.`,
    },
  ];
  const partTwo = await generateValidated(
    partTwoMessages,
    PartTwoSchema,
    'at least 3 days ("Day 5" to "Day 7")',
    (p) => checkDays(p.days),
    (p) => calorieIssues(p.days, partOne.daily_calories)
  );

  let days = [...partOne.days, ...pickDays(partTwo.days, ["Day 5", "Day 6", "Day 7"])];

  // Belt and braces: the model was told, then corrected. An allergen surviving
  // that is a safety failure — refuse the plan rather than hand it to a client.
  if (hasAllergen(days, rules)) {
    throw new Error(
      "AI could not produce an allergen-safe plan (the client's allergen/intolerance kept appearing). Please regenerate."
    );
  }
  days = stripDisliked(days, rules);
  days = stripDietTypeViolations(days, intake.dietType);
  if (dayRules) days = stripDayRuleViolations(days, dayRules, weekdays);

  return DietPlanSchema.parse({ ...partOne, days });
}

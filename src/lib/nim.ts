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
// doesn't fit. Each half fits comfortably.
const PartOneSchema = DietPlanSchema.extend({
  days: z.array(DaySchema).length(4),
});
const PartTwoSchema = z.object({
  days: z.array(DaySchema).length(3),
});

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

export interface PlanContext {
  intake: IntakeForm;
  week: number;
  previousPlan?: DietPlan | null;
  followup?: FollowUpInput | null;
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

function buildSystem(intake: IntakeForm, spec: string, dayRule: string): string {
  const rules = foodRules(intake);
  const forbidden = Array.from(new Set([...rules.allergens, ...rules.disliked]));
  const forbiddenBlock = forbidden.length
    ? `\n\nFORBIDDEN FOODS — these must NEVER appear in any meal, in any form, dish or preparation (not even as part of a dish name):\n${forbidden
        .map((f) => `- ${f}`)
        .join("\n")}\n`
    : "";

  return `You are a senior clinical dietitian creating safe, practical, culturally appropriate diet plans.${forbiddenBlock}

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

LeanR counselling principles — the profile below is a full clinical assessment; use it:
10. SAFETY FIRST. Obey every entry under "red_flags". Kidney disease → no generic high-protein plan and respect any prescribed protein/fluid/electrolyte restriction. Pregnancy/breastfeeding → no aggressive calorie deficit. Possible binge-eating → do NOT intensify restriction; keep the plan permissive and structured. A doctor's food restriction overrides everything else.
11. BUILD AROUND THE CLIENT'S LIFE, NOT AGAINST IT. Keep every item in "non_negotiables_keep_in_plan" (e.g. morning tea, rice, roti, family dinner) and improve those meals instead of deleting them. Do not remove rice or roti by default.
12. START FROM THE CURRENT DIET. Use "current_diet" — keep meals the client already eats where they are workable, and change what the dietitian flagged. Meal times must fit their wake/work/training/sleep times (shift workers get a wake-cycle structure, not a conventional breakfast/lunch/dinner).
13. RESPECT PRACTICAL LIMITS: cooking time available, who cooks, kitchen access, budget, foods that are hard to find, meals the client cannot control, and travel.
14. FOLLOW THE DIETITIAN. "dietitian_plan" carries their clinical decisions — diet structure, protein/carb/fat strategy, meal structure and the 14-day priorities. These override your own preferences.
15. Protein: distribute it across meals (especially breakfast) using the sources this client actually accepts.`;
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
    )}\nAdjust the plan based on progress, adherence and complaints.`;
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
  check?: (value: T) => string[]
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
    if (issues.length === 0) return parsed.data;

    // Forbidden foods slipped in — name them and demand replacements.
    lastError = issues.join("; ");
    messages.push(
      { role: "assistant", content },
      {
        role: "user",
        content:
          `Your plan breaks the client's food rules: ${issues.join("; ")}. ` +
          `These foods are FORBIDDEN — replace each with a different food the client accepts, keeping the same meal structure and calories. ` +
          `Return the complete corrected minified JSON object only. ${expectation}.`,
      }
    );
  }

  throw new Error(`AI returned an invalid diet plan after 3 attempts: ${lastError}`);
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

function foodRules(intake: IntakeForm): FoodRules {
  return {
    allergens: [...splitFoodTerms(intake.allergies), ...splitFoodTerms(intake.intolerances)],
    disliked: splitFoodTerms(intake.dislikes),
  };
}

/** Forbidden terms appearing in the plan's actual meals (not in foods_to_avoid). */
function violations(days: DietPlan["days"], rules: FoodRules): string[] {
  const found = new Map<string, string>();
  for (const day of days) {
    for (const meal of day.meals) {
      for (const item of meal.items) {
        const food = item.food.toLowerCase();
        for (const term of rules.allergens) {
          if (food.includes(term)) found.set(term, `"${item.food}" contains the allergen/intolerance "${term}"`);
        }
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
  const { intake, week, previousPlan } = ctx;

  // ---- Part 1: plan overview + days 1-4
  const partOneMessages: ChatMessage[] = [
    {
      role: "system",
      content: buildSystem(
        intake,
        PART_ONE_SPEC,
        '"days" must contain EXACTLY 4 entries named "Day 1" through "Day 4" (days 5-7 are requested separately).'
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
  const partOne = await generateValidated(
    partOneMessages,
    PartOneSchema,
    'exactly 4 days ("Day 1" to "Day 4")',
    (p) => violations(p.days, rules)
  );

  // ---- Part 2: days 5-7, aware of days 1-4 for variety
  const partTwoMessages: ChatMessage[] = [
    {
      role: "system",
      content: buildSystem(
        intake,
        PART_TWO_SPEC,
        '"days" must contain EXACTLY 3 entries named "Day 5", "Day 6" and "Day 7".'
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
    'exactly 3 days ("Day 5" to "Day 7")',
    (p) => violations(p.days, rules)
  );

  let days = [...partOne.days, ...partTwo.days];

  // Belt and braces: the model was told, then corrected. An allergen surviving
  // that is a safety failure — refuse the plan rather than hand it to a client.
  if (hasAllergen(days, rules)) {
    throw new Error(
      "AI could not produce an allergen-safe plan (the client's allergen/intolerance kept appearing). Please regenerate."
    );
  }
  days = stripDisliked(days, rules);

  return DietPlanSchema.parse({ ...partOne, days });
}

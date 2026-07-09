import { z } from "zod";
import type { FollowUpInput, IntakeForm } from "./types";

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

// ---------------------------------------------------------------------------
// NVIDIA NIM (OpenAI-compatible chat completions endpoint)
// ---------------------------------------------------------------------------

const NIM_URL =
  process.env.NVIDIA_NIM_URL ||
  "https://integrate.api.nvidia.com/v1/chat/completions";
const NIM_MODEL = process.env.NVIDIA_MODEL || "meta/llama-3.1-70b-instruct";

const PLAN_JSON_SPEC = `{
  "summary": string,                  // 2-3 sentence overview of the plan strategy for this client
  "daily_calories": number,           // target kcal/day
  "macros": { "protein_g": number, "carbs_g": number, "fat_g": number },
  "guidelines": string[],             // 4-7 short practical rules
  "hydration": string,                // daily water guidance
  "days": [                           // EXACTLY 7 entries, "Day 1" .. "Day 7"
    {
      "day": string,
      "total_calories": number,
      "meals": [                      // 4-6 meals per day (breakfast, snacks, lunch, dinner)
        {
          "name": string,             // e.g. "Breakfast"
          "time": string,             // e.g. "8:00 AM"
          "items": [ { "food": string, "quantity": string } ],  // quantity compact, e.g. "2 rotis", "150 g"
          "notes": string
        }
      ]
    }
  ],
  "foods_to_avoid": string[]
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

function compactPreviousPlan(plan: DietPlan): string {
  return plan.days
    .map(
      (d) =>
        `${d.day}: ${d.meals
          .map((m) => `${m.name}: ${m.items.map((i) => i.food).join(", ")}`)
          .join(" | ")}`
    )
    .join("\n");
}

function buildMessages(ctx: PlanContext): ChatMessage[] {
  const { intake, week, previousPlan, followup } = ctx;

  const system = `You are a senior clinical dietitian creating safe, practical, culturally appropriate diet plans.

You MUST return ONLY one valid JSON object — no markdown, no code fences, no explanations, no text before or after the JSON.

The JSON must match this exact shape:
${PLAN_JSON_SPEC}

Hard rules:
1. ${dietRules(intake.dietType)}
2. NEVER include any food the client is allergic or intolerant to, in any form or preparation.
3. NEVER include foods the client dislikes.
4. Prefer foods the client likes and their preferred cuisines where healthy.
5. Adapt the plan to all stated medical conditions (e.g. low-GI for diabetes, low-sodium for hypertension, PCOS-friendly, etc.).
6. "days" must contain EXACTLY 7 entries named "Day 1" through "Day 7".
7. Keep food names and quantities short and specific. Use realistic household measures.
8. Calories and macros must be internally consistent and appropriate for the client's stats, activity and goal.`;

  const profile = {
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

  let user = `Create the Week ${week} one-week diet plan for this client:\n${JSON.stringify(profile, null, 2)}`;

  if (followup) {
    user += `\n\nThis week's follow-up check-in:\n${JSON.stringify(
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

  if (previousPlan) {
    user += `\n\nLast week's meals (keep what worked, introduce sensible variety, do not repeat the exact same menu):\n${compactPreviousPlan(previousPlan)}`;
  }

  user += `\n\nReturn ONLY the JSON object.`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
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

async function callNim(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is not configured on the server");
  }

  const res = await fetch(NIM_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: NIM_MODEL,
      messages,
      temperature: 0.5,
      top_p: 0.9,
      max_tokens: 4096,
      stream: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`NVIDIA NIM request failed (${res.status}): ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("NVIDIA NIM returned an empty response");
  return content;
}

/**
 * Generates a validated 1-week diet plan. Makes up to 2 attempts: if the first
 * response fails JSON parsing or schema validation, the errors are fed back to
 * the model for one corrected retry.
 */
export async function generateDietPlan(ctx: PlanContext): Promise<DietPlan> {
  const messages = buildMessages(ctx);
  let lastError = "";

  for (let attempt = 1; attempt <= 2; attempt++) {
    const content = await callNim(messages);

    try {
      const json = extractJson(content);
      const parsed = DietPlanSchema.safeParse(json);
      if (parsed.success) return parsed.data;
      lastError = parsed.error.issues
        .slice(0, 8)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }

    messages.push(
      { role: "assistant", content },
      {
        role: "user",
        content: `Your previous response was not valid. Problems: ${lastError}. Return the complete corrected JSON object only — no other text, exactly 7 days.`,
      }
    );
  }

  throw new Error(`AI returned an invalid diet plan after 2 attempts: ${lastError}`);
}

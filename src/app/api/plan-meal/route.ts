import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  DietPlanSchema,
  MealAlternateSchema,
  generateMealAlternates,
  mealRuleReport,
  parseMealText,
  type DietPlan,
  type MealAlternate,
  type PlanMeal,
} from "@/lib/nim";
import { groundMeals } from "@/lib/nutrition";
import { parseCuisines } from "@/lib/cuisines";
import type { IntakeForm, PlanRevision } from "@/lib/types";

export const runtime = "nodejs";
// 60s is the Vercel Hobby ceiling, and everything here fits inside it: one
// meal's alternatives measured 7-33s, and parsing a typed meal is faster
// still. Unlike whole-plan generation, per-meal editing never needs more.
export const maxDuration = 60;

/** How many "or have this instead" choices one meal may carry in the PDF. */
const MAX_ALTERNATES = 4;

const Target = {
  planId: z.string().uuid(),
  dayIndex: z.number().int().min(0).max(6),
  mealIndex: z.number().int().min(0).max(11),
};

const BodySchema = z.discriminatedUnion("type", [
  // Ask the AI for swap-in choices for one meal. Nothing is stored.
  z.object({ type: z.literal("alternates"), ...Target, count: z.number().int().min(1).max(6).optional() }),
  // Price a meal the dietitian typed themselves. Nothing is stored — this
  // returns the parsed items and their measured macros for them to check.
  z.object({ type: z.literal("custom"), ...Target, text: z.string().trim().min(3).max(600) }),
  // Swap the meal out for the chosen option.
  z.object({ type: z.literal("replace"), ...Target, alternate: MealAlternateSchema, override: z.boolean().optional() }),
  // Keep the meal and print the option under it as an "OR" line.
  z.object({ type: z.literal("add-option"), ...Target, alternate: MealAlternateSchema, override: z.boolean().optional() }),
  z.object({
    type: z.literal("remove-option"),
    ...Target,
    optionIndex: z.number().int().min(0).max(MAX_ALTERNATES - 1),
  }),
]);

const itemLine = (items: MealAlternate["items"]) =>
  items.map((i) => (i.quantity ? `${i.food} (${i.quantity})` : i.food)).join(", ");

/** Identity of an option by its foods, so the same choice is never listed twice. */
const alternateKey = (items: MealAlternate["items"]) =>
  items
    .map((i) => i.food.trim().toLowerCase())
    .sort()
    .join(" | ");

const toAlternate = (meal: PlanMeal): MealAlternate => ({
  items: meal.items,
  notes: meal.notes,
  calories: meal.calories,
  protein_g: meal.protein_g,
  carbs_g: meal.carbs_g,
  fat_g: meal.fat_g,
});

/**
 * Re-costs an option against the foods table as if it were the meal it stands
 * in for, and reports which of its foods the totals EXCLUDE — a food with no
 * database row, or a quantity that would not convert to grams, contributes
 * zero. Inside a generated plan the model's own estimate absorbs that; a meal
 * the dietitian typed has no estimate, so silence there would show them a
 * confidently wrong protein figure.
 *
 * Never fatal: an unseeded or unreachable foods table leaves the estimate in
 * place, exactly as whole-plan grounding does.
 */
async function ground(
  supabase: ReturnType<typeof createClient>,
  meal: PlanMeal,
  alternates: MealAlternate[],
  cuisines?: string[]
): Promise<{ priced: MealAlternate[]; unpriced: string[][] }> {
  const asMeals = alternates.map((a) => ({ ...meal, ...a, alternates: [] }));
  try {
    const { meals, unpriced } = await groundMeals(supabase, asMeals, cuisines);
    return { priced: meals.map(toAlternate), unpriced };
  } catch (e) {
    console.warn(
      "meal alternative grounding skipped:",
      e instanceof Error ? e.message : e
    );
    return { priced: alternates, unpriced: alternates.map(() => []) };
  }
}

/**
 * Per-meal editing of a draft plan from the preview: the dietitian opens one
 * meal, gets AI alternatives for that slot, and either swaps the meal out or
 * offers the option alongside it. Only drafts are editable — an approved plan
 * has a PDF in the client's hands.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // RLS limits this to the caller's own plans.
  const { data: row } = await supabase
    .from("diet_plans")
    .select("id, client_id, week_number, status, plan, starts_on, revisions")
    .eq("id", body.planId)
    .maybeSingle();
  if (!row) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }
  if (row.status !== "draft") {
    return NextResponse.json(
      { error: "This plan has already been approved — meals can no longer be edited" },
      { status: 409 }
    );
  }

  const parsed = DietPlanSchema.safeParse(row.plan);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "The stored draft is not a valid plan — regenerate it instead" },
      { status: 422 }
    );
  }
  const plan = parsed.data;
  const day = plan.days[body.dayIndex];
  const meal = day?.meals[body.mealIndex];
  if (!day || !meal) {
    return NextResponse.json({ error: "That meal is not part of this plan" }, { status: 404 });
  }

  const { data: client } = await supabase
    .from("clients")
    .select("intake")
    .eq("id", row.client_id)
    .maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  const intake = client.intake as IntakeForm;

  /** Writes the edited plan back, recording what the dietitian changed. */
  const save = async (days: DietPlan["days"], note: string) => {
    const revisions: PlanRevision[] = [
      ...((Array.isArray(row.revisions) ? row.revisions : []) as PlanRevision[]),
      { instructions: note, at: new Date().toISOString(), kind: "manual" },
    ];
    const { error } = await supabase
      .from("diet_plans")
      .update({ plan: { ...plan, days }, revisions })
      .eq("id", row.id)
      .eq("status", "draft");
    if (error) throw new Error(`Could not save the edited meal: ${error.message}`);
  };

  /** Replaces this one meal, leaving the rest of the plan untouched. */
  const withMeal = (updated: PlanMeal): DietPlan["days"] => {
    const meals = day.meals.map((m, i) => (i === body.mealIndex ? updated : m));
    return plan.days.map((d, i) =>
      i === body.dayIndex
        ? {
            ...d,
            meals,
            total_calories: Math.round(meals.reduce((s, m) => s + (m.calories || 0), 0)),
          }
        : d
    );
  };

  try {
    if (body.type === "alternates") {
      const alternates = await generateMealAlternates({
        intake,
        week: row.week_number,
        plan,
        dayIndex: body.dayIndex,
        mealIndex: body.mealIndex,
        startsOn: row.starts_on,
        count: body.count,
      });
      // The model sizes options against its own estimates; grounding then
      // re-costs them and some land well off the meal they replace. Closest
      // first, so the readily interchangeable ones are at the top — none are
      // dropped, because a dietitian deliberately choosing a lighter dinner is
      // a legitimate edit and the panel shows every option's delta.
      const { priced } = await ground(supabase, meal, alternates, parseCuisines(intake.cuisines));
      const drift = (a: MealAlternate) =>
        meal.calories > 0 ? Math.abs((a.calories || 0) - meal.calories) / meal.calories : 0;
      return NextResponse.json({
        alternates: priced.sort((a, b) => drift(a) - drift(b)),
      });
    }

    // ---- The dietitian wrote the meal themselves. Structure it, price it
    // from the foods table, and hand the numbers back for them to check.
    // Nothing is stored until they press Replace or Add as option.
    if (body.type === "custom") {
      const parsed = await parseMealText({ intake, text: body.text, mealName: meal.name });
      const { priced, unpriced } = await ground(supabase, meal, [parsed], parseCuisines(intake.cuisines));
      const report = mealRuleReport({
        intake,
        plan,
        dayIndex: body.dayIndex,
        meals: [{ ...meal, ...priced[0] }],
        startsOn: row.starts_on,
      });
      return NextResponse.json({
        alternate: priced[0],
        blocking: report.blocking,
        warnings: report.warnings,
        unmatched: unpriced[0] ?? [],
      });
    }

    if (body.type === "remove-option") {
      const removed = meal.alternates[body.optionIndex];
      if (!removed) {
        return NextResponse.json({ error: "That option is no longer there" }, { status: 404 });
      }
      const days = withMeal({
        ...meal,
        alternates: meal.alternates.filter((_, i) => i !== body.optionIndex),
      });
      await save(days, `${day.day} ${meal.name}: removed the option "${itemLine(removed.items)}"`);
      return NextResponse.json({ ok: true });
    }

    // ---- replace / add-option: the option comes back from the browser, so
    // every rule is enforced again here before it is stored. Its macros are
    // re-costed rather than trusted.
    //
    // An allergen or a break in the diet pattern is refused outright, override
    // or not. Dislikes and weekday observances are the dietitian's call: they
    // are refused once, and accepted when the request comes back with
    // `override` after the UI has shown them exactly what they are overruling.
    const { blocking, warnings } = mealRuleReport({
      intake,
      plan,
      dayIndex: body.dayIndex,
      meals: [{ ...meal, ...body.alternate }],
      startsOn: row.starts_on,
    });
    if (blocking.length > 0) {
      return NextResponse.json(
        { error: `That meal is not safe for this client: ${blocking.join("; ")}`, blocking },
        { status: 422 }
      );
    }
    if (warnings.length > 0 && !body.override) {
      return NextResponse.json(
        {
          error: `This goes against the client's recorded preferences: ${warnings.join("; ")}`,
          warnings,
          overridable: true,
        },
        { status: 409 }
      );
    }

    const [alternate] = (await ground(supabase, meal, [body.alternate], parseCuisines(intake.cuisines))).priced;
    const key = alternateKey(alternate.items);
    // An overruled preference is recorded in the plan's history — a later
    // reviewer must be able to see that it was a deliberate decision.
    const overruled = warnings.length > 0 ? ` [dietitian overrode: ${warnings.join("; ")}]` : "";

    if (body.type === "replace") {
      const days = withMeal({
        ...meal,
        items: alternate.items,
        notes: alternate.notes,
        calories: alternate.calories,
        protein_g: alternate.protein_g,
        carbs_g: alternate.carbs_g,
        fat_g: alternate.fat_g,
        // The choice that just became the meal is no longer an alternative to it.
        alternates: meal.alternates.filter((a) => alternateKey(a.items) !== key),
      });
      await save(
        days,
        `${day.day} ${meal.name}: replaced "${itemLine(meal.items)}" with "${itemLine(alternate.items)}"${overruled}`
      );
      return NextResponse.json({ ok: true });
    }

    if (meal.alternates.length >= MAX_ALTERNATES) {
      return NextResponse.json(
        {
          error: `This meal already offers ${MAX_ALTERNATES} options — remove one before adding another.`,
        },
        { status: 409 }
      );
    }
    if (key === alternateKey(meal.items) || meal.alternates.some((a) => alternateKey(a.items) === key)) {
      return NextResponse.json(
        { error: "This meal already offers that option" },
        { status: 409 }
      );
    }

    const days = withMeal({ ...meal, alternates: [...meal.alternates, alternate] });
    await save(
      days,
      `${day.day} ${meal.name}: added the option "${itemLine(alternate.items)}"${overruled}`
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    console.error(`plan-meal ${body.type} failed:`, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

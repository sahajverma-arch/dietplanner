import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { groundMeals } from "@/lib/nutrition";

export const runtime = "nodejs";
// Database work only — no model call — so this is fast and fits any plan.
export const maxDuration = 60;

/**
 * Prices what a client actually eats, during the counselling.
 *
 * The dietitian records a meal variant ("4 bread, 2 eggs") and this returns its
 * protein and calories from the SAME foods table the diet plans are costed
 * with. That matters more than it sounds: if intake were estimated on one scale
 * and the plan built on another, "eats 45 g, target 90 g" would be comparing
 * two different measurements and the progression would be built on the gap
 * between them rather than a real one.
 *
 * Foods the table cannot price are named back, because they contribute zero and
 * would otherwise quietly deflate the client's recorded intake.
 */
const BodySchema = z.object({
  items: z
    .array(
      z.object({
        food: z.string().trim().min(1),
        quantity: z.string().trim().default(""),
      })
    )
    .min(1)
    .max(12),
});

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const { meals, unpriced } = await groundMeals(supabase, [
      {
        name: "Intake",
        time: "",
        items: body.items,
        notes: "",
        // Zero, so grounding reports the database's own total rather than
        // falling back to an estimate nobody made.
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        alternates: [],
      },
    ]);
    const priced = meals[0];
    return NextResponse.json({
      macros: {
        calories: Math.round(priced.calories),
        protein_g: Math.round(priced.protein_g),
        carbs_g: Math.round(priced.carbs_g),
        fat_g: Math.round(priced.fat_g),
      },
      unpriced: unpriced[0] ?? [],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not price that meal";
    console.error("price-meal failed:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

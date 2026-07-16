// Human-in-the-loop revision test: draft preview → dietitian's written change
// instructions → revised draft. Exercises exactly the code path of
// POST /api/generate-plan type:"revise", minus the HTTP/auth wrapper and DB
// writes — plus a read-only check that migration 0007's columns exist.
//
// Run: npx -y tsx scripts/test-revision-loop.ts

import { readFileSync } from "node:fs";
import path from "node:path";
import { PRIYA } from "./test-clients";

// .env.local must be in process.env BEFORE the libs are imported (nim.ts reads
// NVIDIA_MODEL at module load), hence the dynamic imports in main().
const envPath = path.join(__dirname, "..", ".env.local");
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

type Plan = import("../src/lib/nim").DietPlan;

/** Average per-day protein from the (grounded) meal macros. */
function avgDayProtein(plan: Plan): number {
  const totals = plan.days.map((d) => d.meals.reduce((s, m) => s + (m.protein_g || 0), 0));
  return Math.round(totals.reduce((a, b) => a + b, 0) / totals.length);
}

/** Foods appearing on 3+ days — the "repeated foods" the dietitian complains about. */
function repeatedFoods(plan: Plan): string[] {
  const daysWithFood = new Map<string, Set<string>>();
  for (const day of plan.days)
    for (const meal of day.meals)
      for (const item of meal.items) {
        const key = item.food.trim().toLowerCase();
        if (!daysWithFood.has(key)) daysWithFood.set(key, new Set());
        daysWithFood.get(key)!.add(day.day);
      }
  return Array.from(daysWithFood.entries())
    .filter(([, days]) => days.size >= 3)
    .sort((a, b) => b[1].size - a[1].size)
    .map(([food, days]) => `${food} (${days.size}d)`);
}

function breakfasts(plan: Plan): string[] {
  return plan.days.map((d) => {
    const meal = d.meals.find((m) => /breakfast/i.test(m.name)) ?? d.meals[0];
    return meal.items.map((i) => i.food).join(", ");
  });
}

function report(label: string, plan: Plan) {
  console.log(`\n---- ${label} ----`);
  console.log(
    `target: ${Math.round(plan.daily_calories)} kcal/day, ` +
      `P${Math.round(plan.macros.protein_g)} C${Math.round(plan.macros.carbs_g)} F${Math.round(plan.macros.fat_g)}` +
      ` | grounded avg protein/day: ${avgDayProtein(plan)} g`
  );
  const rep = repeatedFoods(plan);
  console.log(`foods on 3+ days: ${rep.length ? rep.join("; ") : "none"}`);
  console.log(`breakfasts:\n${breakfasts(plan).map((b, i) => `  Day ${i + 1}: ${b}`).join("\n")}`);
}

async function main() {
  const { toIntake } = await import("../src/lib/counselling/assessment");
  const { generateDietPlan } = await import("../src/lib/nim");
  const { groundPlan } = await import("../src/lib/nutrition");
  const { createClient } = await import("@supabase/supabase-js");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ---- 0. migration 0007 columns exist (read-only)
  const { error: colError } = await supabase
    .from("diet_plans")
    .select("status, starts_on, revisions")
    .limit(1);
  if (colError) {
    console.error(`!! migration 0007 not applied? ${colError.message}`);
    process.exit(1);
  }
  console.log("migration 0007 columns (status, starts_on, revisions): present");

  const intake = toIntake(PRIYA, null);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const startsOn = tomorrow.toISOString().slice(0, 10);

  // ---- 1. the draft preview, as the generation path stores it
  const t0 = Date.now();
  console.log(`\n1) generating DRAFT preview for ${intake.fullName} (2 NIM calls)…`);
  let draft = await generateDietPlan({
    intake, week: 1, previousPlan: null, followup: null, review: null, startsOn,
  });
  try {
    draft = (await groundPlan(supabase as any, draft)).plan;
  } catch (e) {
    console.warn("grounding skipped:", e instanceof Error ? e.message : e);
  }
  report(`DRAFT (${((Date.now() - t0) / 1000).toFixed(0)}s)`, draft);

  // ---- 2. the dietitian's written intervention (the new feature)
  const instructions =
    "Protein is too high — bring the daily protein down to about 60 g and shrink the protein portions to match. " +
    "The menu is repetitive — no main food may appear on more than 2 days, and every day's breakfast must be clearly different from the other days.";
  console.log(`\n2) revising with dietitian instructions:\n   "${instructions}"`);

  const t1 = Date.now();
  let revised = await generateDietPlan({
    intake, week: 1, previousPlan: null, followup: null, review: null, startsOn,
    revision: { draft, instructions },
  });
  try {
    revised = (await groundPlan(supabase as any, revised)).plan;
  } catch (e) {
    console.warn("grounding skipped:", e instanceof Error ? e.message : e);
  }
  report(`REVISED (${((Date.now() - t1) / 1000).toFixed(0)}s)`, revised);

  // ---- 3. did the model follow the instructions?
  console.log("\n---- checks ----");
  const pBefore = Math.round(draft.macros.protein_g);
  const pAfter = Math.round(revised.macros.protein_g);
  console.log(
    `protein target ${pBefore}g -> ${pAfter}g: ` +
      (pAfter < pBefore || pBefore <= 65 ? "reduced as instructed" : "!! NOT reduced")
  );
  const bfs = breakfasts(revised).map((b) => b.toLowerCase());
  const distinct = new Set(bfs).size;
  console.log(
    `distinct breakfasts: ${distinct}/7 ` + (distinct >= 6 ? "(varied)" : "!! still repetitive")
  );
  const repBefore = repeatedFoods(draft).length;
  const repAfter = repeatedFoods(revised).length;
  console.log(
    `foods on 3+ days: ${repBefore} -> ${repAfter} ` +
      (repAfter <= repBefore ? "(variety improved or equal)" : "!! repetition increased")
  );

  console.log("\nDone.");
}

main().catch((e) => {
  console.error("\nRevision-loop test failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});

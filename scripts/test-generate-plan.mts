// QA tool: generates a real diet plan with the same code path as
// /api/generate-plan — NIM generation, grounding against the live foods
// table, PDF render — and prints an AI-estimate vs database-grounded
// comparison per meal. Run: npx tsx scripts/test-generate-plan.mts
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Load .env.local before importing nim.ts (it reads env at module load)
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

const { generateDietPlan } = await import("../src/lib/nim");
const { groundPlan } = await import("../src/lib/nutrition");
const { renderPlanPdf } = await import("../src/lib/pdf");

const intake = {
  fullName: "Test Client (Priya)",
  age: "32",
  gender: "female",
  heightCm: "163",
  weightKg: "78",
  targetWeightKg: "68",
  goal: "weight loss",
  occupation: "software engineer (desk job)",
  dietType: "vegetarian",
  cuisines: ["North Indian"],
  mealsPerDay: "4",
  likes: "paneer, dal, seasonal fruits",
  dislikes: "bottle gourd (lauki)",
  allergies: "",
  intolerances: "",
  cookingTime: "30 minutes",
  activityLevel: "sedentary",
  exercise: "30 min walk, 4x/week",
  sleepHours: "7",
  wakeTime: "07:00",
  bedTime: "23:30",
  waterIntakeLitres: "2",
  smoking: "no",
  alcohol: "no",
  eatingOutPerWeek: "1",
  workSchedule: "9:30-18:30",
  conditions: ["PCOS"],
  medications: "",
  supplements: "",
  digestion: "normal",
  labNotes: "",
  notes: "",
};

console.log("Generating plan via NVIDIA NIM…");
const t0 = Date.now();
let raw: any = null;
for (let attempt = 1; attempt <= 4 && !raw; attempt++) {
  try {
    raw = await generateDietPlan({ intake: intake as any, week: 1 });
  } catch (e) {
    console.log(`attempt ${attempt} failed (${e instanceof Error ? e.message.slice(0, 90) : e}), retrying…`);
  }
}
if (!raw) throw new Error("NIM endpoint too congested — try again later");
console.log(`Generated in ${Math.round((Date.now() - t0) / 1000)}s`);

const before = structuredClone(raw);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
const { plan, stats } = await groundPlan(supabase as any, raw);

console.log("\n=== GROUNDING STATS ===");
console.log(JSON.stringify(stats));
console.log(`\nDaily target: ${plan.daily_calories} kcal | P ${plan.macros.protein_g} C ${plan.macros.carbs_g} F ${plan.macros.fat_g}`);

for (let d = 0; d < plan.days.length; d++) {
  const day = plan.days[d];
  const prev = before.days[d];
  console.log(`\n--- ${day.day} (AI day total ${prev.total_calories ?? "?"} -> grounded ${day.total_calories}) ---`);
  for (let m = 0; m < day.meals.length; m++) {
    const meal = day.meals[m];
    const old = prev.meals[m];
    const changed = meal.calories !== old.calories ? "GROUNDED" : "ai-est  ";
    const items = meal.items.map((i) => `${i.food} [${i.quantity}]`).join(", ");
    console.log(
      `${changed} ${meal.name.padEnd(18)} AI ${String(old.calories).padStart(4)} -> ${String(meal.calories).padStart(4)} kcal | ${items}`
    );
  }
}

console.log("\nRendering PDF…");
const pdf = await renderPlanPdf({
  plan,
  clientName: intake.fullName,
  weekNumber: 1,
  dietitianName: "Test Dietitian",
  generatedOn: "12 July 2026",
  startDateIso: "2026-07-13T00:00:00.000Z",
  dietType: intake.dietType,
  conditions: intake.conditions,
});
const out = "C:/Users/vsaha/AppData/Local/Temp/claude/C--Users-vsaha-dietitian-platform/5196cb37-4629-48fe-aeca-57cb904e7a15/scratchpad/test-plan.pdf";
writeFileSync(out, pdf);
console.log("PDF written:", out, `(${Math.round(pdf.length / 1024)} KB)`);

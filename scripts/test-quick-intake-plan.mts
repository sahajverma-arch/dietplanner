// End-to-end proof that a quick-intake submission (sparse real answers +
// fillUnaskedRequired() sentinel fill) genuinely produces a working diet
// plan through the real pipeline — not just that missingRequired() is
// satisfied in isolation. Exercises exactly what /api/generate-plan does:
// aiClinicalReview -> generateDietPlan -> groundPlan.
//
// Run: npx tsx scripts/test-quick-intake-plan.mts
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function loadEnvLocal() {
  const text = readFileSync(join(root, ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
loadEnvLocal();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { missingRequired, problemTypeId, PROBLEM_ALLERGY } = await import("../src/lib/counselling/questions");
const { fillUnaskedRequired, isQuickIntake, QUICK_INTAKE_MARKER_ID } = await import("../src/lib/counselling/quick-intake");
const { toIntake } = await import("../src/lib/counselling/assessment");
const { aiClinicalReview, isPauseDecision, generateDietPlan } = await import("../src/lib/nim");
const { groundPlan } = await import("../src/lib/nutrition");

// Exactly what QuickCounsellingForm.buildSubmission() produces for a
// representative fill of its curated question groups.
const quick: Record<string, string | string[]> = {
  name: "Quick Intake Test",
  gender: "Male",
  phone: "+91 90000 00000",
  q9_age: "29",
  q9_height: "175",
  q9_weight: "88",
  q2: "Fat Loss With Muscle Preservation",
  q76_category: "First-timer — never dieted with structure before",
  q54c: "Moderately active",
  q43: ["Strength training", "Walking"],
  q44a: "4",
  q44b: "45–60 minutes",
  q44e: "Moderate",
  q44d: "6–12 months",
  q33: "Non-vegetarian",
  q27: ["No known allergy or intolerance"],
  q36: "Bitter gourd, okra",
  q35: "Chicken, eggs, rice",
  q34: ["North Indian", "Punjabi"],
  q28: ["Breakfast", "Lunch", "Evening", "Dinner"],
  q38: ["No restriction"],
  q17: ["No Medical Condition"],
  q19: "No",
  q19a: "None",
  q50a: "3",
};
for (const food of quick.q27 as string[]) {
  if (food !== "No known allergy or intolerance") quick[problemTypeId(food)] = PROBLEM_ALLERGY;
}
quick[QUICK_INTAKE_MARKER_ID] = "true";
// The current-intake override QuickCounsellingForm writes from the 3 number inputs.
quick["q112_intake_override"] = JSON.stringify({ calories: 1800, protein_g: 110, carbs_g: 180, fat_g: 60 });

const filled = fillUnaskedRequired(quick);

console.log("[1/4] missingRequired() check...");
const missing = missingRequired(filled);
console.log(`  ${missing.length} missing (must be 0)`);
if (missing.length > 0) {
  console.log("  " + missing.map((m) => m.questionId).join(", "));
  process.exit(1);
}

const intake = toIntake(filled as any);
console.log(`\nClient: ${intake.fullName} — ${intake.dietType}, cuisines: ${intake.cuisines}`);

console.log("\n[2/4] AI clinical review...");
// Mirrors the exact conditional now in /api/generate-plan and /api/plan-step.
let review = null;
if (isQuickIntake(filled)) {
  console.log("  Skipped — quick-intake client (matches the route's new isQuickIntake() check).");
} else {
  review = await aiClinicalReview(intake);
  console.log(`  Decision: ${review.decision}`);
  console.log(`  Safety: ${review.safety_classification}`);
  if (isPauseDecision(review)) {
    console.log("  PAUSED — missing_information:", review.missing_information);
  }
}

console.log("\n[3/4] Generating week 1...");
const startsOn = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const t0 = Date.now();
const plan = await generateDietPlan({ intake, week: 1, review, startsOn });
console.log(`  generated in ${Math.round((Date.now() - t0) / 1000)}s`);
console.log(`  target: ${plan.daily_calories} kcal, P${plan.macros.protein_g} C${plan.macros.carbs_g} F${plan.macros.fat_g}`);
console.log(`  ${plan.days.length} days generated`);

console.log("\n[4/4] Grounding...");
const { stats } = await groundPlan(supabase as any, plan, ["North Indian", "Punjabi"]);
console.log(`  ${stats.grounded_meals}/${stats.total_meals} meals, ${stats.matched_items}/${stats.total_items} items grounded`);

console.log("\n=== RESULT ===");
for (const day of plan.days) {
  const names = day.meals.map((m) => m.name);
  console.log(`${day.day}: ${day.total_calories}kcal, meals=[${names.join(", ")}]`);
}
console.log("\nFull pipeline completed without error — quick-intake data produces a real plan.");

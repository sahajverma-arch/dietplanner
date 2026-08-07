// Full-pipeline demo of a Quick Counselling submission: builds the same
// sparse answers QuickCounsellingForm.buildSubmission() would (real curated
// answers + fillUnaskedRequired() sentinel fill), then runs the exact
// pipeline /api/plan-step now runs for a quick-intake client — AI review
// skipped, generate -> ground -> reconcile -> save -> regionalize -> PDF.
//
// Run: npx tsx scripts/create-quick-intake-plan.mts <dietitian-email>
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
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

const email = process.argv[2];
if (!email) {
  console.error("Usage: npx tsx scripts/create-quick-intake-plan.mts <dietitian-email>");
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { missingRequired, problemTypeId, PROBLEM_ALLERGY, PROBLEM_NONE } = await import("../src/lib/counselling/questions");
const { fillUnaskedRequired, isQuickIntake, QUICK_INTAKE_MARKER_ID } = await import("../src/lib/counselling/quick-intake");
const { toIntake } = await import("../src/lib/counselling/assessment");
const { generateDietPlan } = await import("../src/lib/nim");
const { groundPlan } = await import("../src/lib/nutrition");
const { reconcileNutrition, daysOverCeiling } = await import("../src/lib/nutrition-reconcile");
const { regionalizePlan } = await import("../src/lib/regional-names");
const { renderPlanPdf } = await import("../src/lib/pdf");
const { parseCuisines } = await import("../src/lib/cuisines");

const toNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// A representative fill of QuickCounsellingForm's curated groups.
const quick: Record<string, string | string[]> = {
  name: "Quick Intake Demo",
  gender: "Female",
  phone: "+91 90000 11111",
  q9_age: "34",
  q9_height: "160",
  q9_weight: "72",
  q2: "Fat Loss",
  q76_category: "First-timer — never dieted with structure before",
  q54c: "Lightly active",
  q43: ["Walking", "Yoga"],
  q44d: "Complete beginner",
  q33: "Vegetarian",
  q27: ["No known allergy or intolerance"],
  q36: "Bitter gourd",
  q35: "Paneer, dal, rice",
  q34: ["South Indian", "Kerala-style"],
  q28: ["Breakfast", "Lunch", "Evening", "Dinner"],
  q38: ["No restriction"],
  q17: ["PCOS/PCOD"],
  q19: "No",
  q19a: "None",
  q50a: "2",
};
for (const food of quick.q27 as string[]) {
  if (food === PROBLEM_NONE) continue;
  quick[problemTypeId(food)] = PROBLEM_ALLERGY;
}
quick[QUICK_INTAKE_MARKER_ID] = "true";
quick["q112_intake_override"] = JSON.stringify({ calories: 1500, protein_g: 60, carbs_g: 200, fat_g: 45 });

async function main() {
  const { data: profile } = await supabase.from("profiles").select("id, email, full_name").ilike("email", email).maybeSingle();
  if (!profile) { console.error("Profile not found"); process.exit(1); }

  const filled = fillUnaskedRequired(quick);
  const missing = missingRequired(filled);
  console.log(`missingRequired() check: ${missing.length} missing (must be 0)`);
  if (missing.length > 0) { console.error(missing.map((m) => m.questionId).join(", ")); process.exit(1); }

  const intake = toIntake(filled as any);
  console.log(`Client: ${intake.fullName} — ${intake.dietType}, cuisines: ${intake.cuisines}`);

  console.log(`\n[1/5] AI clinical review: ${isQuickIntake(filled) ? "skipped (quick intake)" : "running"}...`);
  const review = null; // matches the route's isQuickIntake() skip

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      dietitian_id: profile.id,
      full_name: intake.fullName.trim(),
      age: toNum(intake.age),
      gender: intake.gender || null,
      height_cm: toNum(intake.heightCm),
      weight_kg: toNum(intake.weightKg),
      goal: intake.goal || null,
      diet_type: intake.dietType || null,
      phone: intake.phone || null,
      email: intake.email || null,
      intake,
    })
    .select("id")
    .single();
  if (clientError) { console.error("Client insert failed:", clientError.message); process.exit(1); }
  console.log(`Created client: ${client.id}`);

  console.log("\n[2/5] Generating week 1...");
  const t0 = Date.now();
  const startsOn = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  let plan = await generateDietPlan({ intake, week: 1, review, startsOn });
  console.log(`  generated in ${Math.round((Date.now() - t0) / 1000)}s`);

  console.log("\n[3/5] Grounding...");
  const cuisines = parseCuisines(intake.cuisines);
  const grounded = await groundPlan(supabase as any, plan, cuisines);
  plan = grounded.plan;
  console.log(`  ${grounded.stats.grounded_meals}/${grounded.stats.total_meals} meals, ${grounded.stats.matched_items}/${grounded.stats.total_items} items`);

  console.log("\n[4/5] Nutrition reconcile...");
  const topup = await reconcileNutrition(supabase as any, plan, { intake, week: 1, review, startsOn } as any);
  plan = topup.plan;
  console.log(`  ${topup.applied ? "applied" : "skipped"}: ${topup.reason}`);
  const over = daysOverCeiling(plan);
  if (over.length > 0) console.log(`  NOTE: ${over.length} day(s) still over ceiling`);

  console.log("\n=== FINAL WEEK ===");
  for (const day of plan.days) {
    const names = day.meals.map((m: any) => m.name);
    const protein = Math.round(day.meals.reduce((s: number, m: any) => s + (m.protein_g || 0), 0));
    console.log(`${day.day}: ${day.total_calories}kcal, protein=${protein}g, meals=[${names.join(", ")}]`);
  }
  console.log(`Week target: ${Math.round(plan.daily_calories)}kcal, P${Math.round(plan.macros.protein_g)}g`);

  const { data: planRow, error: planError } = await supabase
    .from("diet_plans")
    .insert({ client_id: client.id, dietitian_id: profile.id, week_number: 1, source: "first_counselling", status: "draft", starts_on: startsOn, plan, ai_review: review })
    .select("id").single();
  if (planError) throw new Error(planError.message);

  console.log("\n[5/5] Approving — regional naming + PDF...");
  const pdfPlan = await regionalizePlan(supabase as any, plan, cuisines);
  const pdfBuffer = await renderPlanPdf({
    plan: pdfPlan, clientName: intake.fullName, weekNumber: 1,
    dietitianName: profile.full_name || profile.email || "Your dietitian",
    generatedOn: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    startDateIso: startsOn, dietType: intake.dietType || "", conditions: Array.isArray(intake.conditions) ? intake.conditions : [],
    cuisines: intake.cuisines,
  });
  const pdfPath = `${profile.id}/${client.id}/week-1-${Date.now()}.pdf`;
  await supabase.storage.from("diet-pdfs").upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
  await supabase.from("diet_plans").update({ status: "final", pdf_path: pdfPath }).eq("id", planRow.id);
  writeFileSync(join(root, "quick-intake-demo.pdf"), pdfBuffer);

  console.log(`\nDone. Client ${client.id}. Plan ${planRow.id}. PDF: ${join(root, "quick-intake-demo.pdf")}`);
}
main();

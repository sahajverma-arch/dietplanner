// Full-pipeline plan generation for the PRIYA test fixture — same pipeline as
// create-kavya-plan-v2.mts (generate -> ground -> reconcile -> regionalize ->
// PDF), but also creates the client first from scripts/test-clients.ts,
// since Priya (unlike Kavya) has no pre-existing client this run reuses.
//
// Run: npx tsx scripts/create-priya-plan.mts <dietitian-email>
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
  console.error("Usage: npx tsx scripts/create-priya-plan.mts <dietitian-email>");
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { toIntake } = await import("../src/lib/counselling/assessment");
const { PRIYA } = await import("./test-clients");
const { aiClinicalReview, isPauseDecision, generateDietPlan } = await import("../src/lib/nim");
const { groundPlan } = await import("../src/lib/nutrition");
const { reconcileNutrition, daysOverCeiling } = await import("../src/lib/nutrition-reconcile");
const { regionalizePlan } = await import("../src/lib/regional-names");
const { renderPlanPdf } = await import("../src/lib/pdf");
const { parseCuisines } = await import("../src/lib/cuisines");

const toNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function main() {
  const { data: profile } = await supabase.from("profiles").select("id, email, full_name").ilike("email", email).maybeSingle();
  if (!profile) { console.error("Profile not found"); process.exit(1); }

  const intake = toIntake(PRIYA as any);
  console.log(`Client: ${intake.fullName} — ${intake.dietType}, cuisines: ${intake.cuisines}`);

  console.log("\n[1/6] AI clinical review...");
  const review = await aiClinicalReview(intake);
  if (isPauseDecision(review)) { console.log("PAUSED:", review.missing_information); process.exit(1); }

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

  console.log("\n[2/6] Generating week 1...");
  const t0 = Date.now();
  const startsOn = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  let plan = await generateDietPlan({ intake, week: 1, review, startsOn });
  console.log(`  generated in ${Math.round((Date.now() - t0) / 1000)}s`);

  console.log("\n[3/6] Grounding — the exchange list (the real production path)...");
  const cuisines = parseCuisines(intake.cuisines);
  const grounded = await groundPlan(supabase as any, plan, cuisines);
  plan = grounded.plan;
  console.log(`  ${grounded.stats.grounded_meals}/${grounded.stats.total_meals} meals, ${grounded.stats.matched_items}/${grounded.stats.total_items} items`);

  console.log("\n[4/6] Nutrition reconcile...");
  const topup = await reconcileNutrition(supabase as any, plan, { intake, week: 1, review, startsOn });
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

  console.log("\n[5/6] Saving draft...");
  const { data: planRow, error: planError } = await supabase
    .from("diet_plans")
    .insert({ client_id: client.id, dietitian_id: profile.id, week_number: 1, source: "first_counselling", status: "draft", starts_on: startsOn, plan, ai_review: review })
    .select("id").single();
  if (planError) throw new Error(planError.message);

  console.log("\n[6/6] Approving — regional naming + PDF...");
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
  writeFileSync(join(root, "priya-week1.pdf"), pdfBuffer);

  console.log(`\nDone. Client ${client.id}. Plan ${planRow.id}. PDF: ${join(root, "priya-week1.pdf")}`);
}
main();

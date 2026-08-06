// Same as create-kavya-plan-exchange-only.mts but NORMAL (blended) grounding —
// verifying the dinner-completeness and protein-consistency fixes through the
// real production path, for the SAME existing Kavya client.
//
// Run: npx tsx scripts/create-kavya-plan-v2.mts <dietitian-email> <client-id>
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

const [email, clientId] = process.argv.slice(2);
if (!email || !clientId) {
  console.error("Usage: npx tsx scripts/create-kavya-plan-v2.mts <dietitian-email> <client-id>");
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { aiClinicalReview, isPauseDecision, generateDietPlan } = await import("../src/lib/nim");
const { groundPlan } = await import("../src/lib/nutrition");
const { reconcileNutrition, daysOverCeiling } = await import("../src/lib/nutrition-reconcile");
const { regionalizePlan } = await import("../src/lib/regional-names");
const { renderPlanPdf } = await import("../src/lib/pdf");
const { parseCuisines } = await import("../src/lib/cuisines");

async function main() {
  const { data: profile } = await supabase.from("profiles").select("id, email, full_name").ilike("email", email).maybeSingle();
  if (!profile) { console.error("Profile not found"); process.exit(1); }

  const { data: client } = await supabase.from("clients").select("id, full_name, intake").eq("id", clientId).single();
  if (!client) { console.error("Client not found"); process.exit(1); }
  const intake = client.intake as any;
  console.log(`Client: ${intake.fullName} — ${intake.dietType}, cuisines: ${intake.cuisines}`);

  console.log("\n[1/5] AI clinical review...");
  const review = await aiClinicalReview(intake);
  if (isPauseDecision(review)) { console.log("PAUSED:", review.missing_information); process.exit(1); }

  console.log("\n[2/5] Generating week 1...");
  const t0 = Date.now();
  const startsOn = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  let plan = await generateDietPlan({ intake, week: 1, review, startsOn });
  console.log(`  generated in ${Math.round((Date.now() - t0) / 1000)}s`);

  console.log("\n[3/5] Grounding — NORMAL (blended INDB/USDA + exchange list)...");
  const cuisines = parseCuisines(intake.cuisines);
  const grounded = await groundPlan(supabase as any, plan, cuisines);
  plan = grounded.plan;
  console.log(`  ${grounded.stats.grounded_meals}/${grounded.stats.total_meals} meals, ${grounded.stats.matched_items}/${grounded.stats.total_items} items`);

  console.log("\n[4/5] Nutrition reconcile...");
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
  const pdfPath = `${profile.id}/${client.id}/week-1-v2-${Date.now()}.pdf`;
  await supabase.storage.from("diet-pdfs").upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
  await supabase.from("diet_plans").update({ status: "final", pdf_path: pdfPath }).eq("id", planRow.id);
  writeFileSync(join(root, "kavya-week1-v2.pdf"), pdfBuffer);

  console.log(`\nDone. Plan ${planRow.id}. PDF: ${join(root, "kavya-week1-v2.pdf")}`);
}
main();

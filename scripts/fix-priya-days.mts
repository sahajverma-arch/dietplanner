// Targeted correction for Priya's current plan: reconcileNutrition() already
// ran once during generation (deviation 481 -> 383 -> 294, then a 3rd round
// was correctly rejected for regressing calories) and left Sat/Sun under the
// calorie target and Wed/Thu well over the protein target. Re-running
// reconcileNutrition() from THIS saved state (not the original draft) gives
// it a fresh MAX_ROUNDS budget and a different starting point, so it may
// clear days the first pass couldn't — reconcileNeed() finds and directs
// correction for whichever days are still off-band, whichever direction.
//
// Run: npx tsx scripts/fix-priya-days.mts <plan-id>
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

const planId = process.argv[2];
if (!planId) {
  console.error("Usage: npx tsx scripts/fix-priya-days.mts <plan-id>");
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { reconcileNutrition, daysOverCeiling } = await import("../src/lib/nutrition-reconcile");
const { dayProtein, dayCalories } = await import("../src/lib/day-targets");
const { regionalizePlan } = await import("../src/lib/regional-names");
const { renderPlanPdf } = await import("../src/lib/pdf");
const { parseCuisines } = await import("../src/lib/cuisines");

async function main() {
  const { data: row } = await supabase.from("diet_plans").select("*").eq("id", planId).single();
  if (!row) throw new Error("Plan not found");
  const plan = row.plan as any;

  const { data: client } = await supabase.from("clients").select("id, full_name, dietitian_id, intake").eq("id", row.client_id).single();
  if (!client) throw new Error("Client not found");
  const intake = client.intake as any;
  const { data: profile } = await supabase.from("profiles").select("id, email, full_name").eq("id", client.dietitian_id).single();

  console.log("Before:");
  for (const d of plan.days) {
    console.log(`  ${d.day}: ${Math.round(dayCalories(d))}kcal, protein=${Math.round(dayProtein(d))}g`);
  }
  console.log(`Target: ~${Math.round(plan.daily_calories)}kcal, P${Math.round(plan.macros.protein_g)}g`);

  console.log("\nRunning reconcileNutrition() again from the saved state...");
  const startsOn = row.starts_on;
  const result = await reconcileNutrition(supabase as any, plan, { intake, week: row.week_number, startsOn } as any);
  console.log(`${result.applied ? "applied" : "skipped"}: ${result.reason}`);

  const finalPlan = result.plan;
  console.log("\nAfter:");
  for (const d of finalPlan.days) {
    console.log(`  ${d.day}: ${Math.round(dayCalories(d))}kcal, protein=${Math.round(dayProtein(d))}g`);
  }
  const over = daysOverCeiling(finalPlan);
  if (over.length) console.log(`NOTE: ${over.length} day(s) still over ceiling: ${over.map((d: any) => d.day).join(", ")}`);

  if (!result.applied) {
    console.log("\nNo change saved — the correction did not improve on the current plan.");
    return;
  }

  await supabase.from("diet_plans").update({ plan: finalPlan }).eq("id", planId);
  console.log("\nSaved corrected plan.");

  console.log("\nRe-approving — regional naming + PDF...");
  const cuisines = parseCuisines(intake.cuisines);
  const pdfPlan = await regionalizePlan(supabase as any, finalPlan, cuisines);
  const pdfBuffer = await renderPlanPdf({
    plan: pdfPlan,
    clientName: client.full_name,
    weekNumber: row.week_number,
    dietitianName: profile?.full_name || profile?.email || "Your dietitian",
    generatedOn: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    startDateIso: row.starts_on,
    dietType: intake.dietType || "",
    conditions: Array.isArray(intake.conditions) ? intake.conditions : [],
    cuisines: intake.cuisines,
  });
  const pdfPath = `${client.dietitian_id}/${client.id}/week-${row.week_number}-fixed-${Date.now()}.pdf`;
  await supabase.storage.from("diet-pdfs").upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
  await supabase.from("diet_plans").update({ pdf_path: pdfPath }).eq("id", planId);
  writeFileSync(join(root, "priya-week1.pdf"), pdfBuffer);
  console.log(`PDF: ${join(root, "priya-week1.pdf")}`);
}

main();

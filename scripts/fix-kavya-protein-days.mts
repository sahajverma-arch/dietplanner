// Targeted correction for Kavya's current plan: Days 5-7 (Mon/Tue/Wed) came
// out at 34g/34g/39g protein against a 62g target while Days 1-4 sit at
// 51-59g — the previous whole-week reconcile round DID improve this
// (deviation 1692 -> 428) but was rejected outright because some other day's
// rebuild breached the calorie ceiling, discarding the improvement along with
// the breach. Days 1-4 are already good, so this rebuilds ONLY 5-7 and
// reuses the same acceptRevision() gate reconcileNutrition itself uses,
// rather than overwriting blind.
//
// Run: npx tsx scripts/fix-kavya-protein-days.mts <plan-id>
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

const [planId, daysArg] = process.argv.slice(2);
if (!planId) {
  console.error("Usage: npx tsx scripts/fix-kavya-protein-days.mts <plan-id> [comma,separated,day,names]");
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { generatePlanDays } = await import("../src/lib/nim");
const { groundPlan } = await import("../src/lib/nutrition");
const { acceptRevision, daysOverCeiling } = await import("../src/lib/nutrition-reconcile");
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

  const targetDays = daysArg ? daysArg.split(",").map((s) => s.trim()) : ["Day 5", "Day 6", "Day 7"];
  console.log("Before:");
  for (const d of plan.days.filter((d: any) => targetDays.includes(d.day))) {
    console.log(`  ${d.day}: ${Math.round(dayCalories(d))}kcal, protein=${Math.round(dayProtein(d))}g`);
  }

  const overview = { ...plan, days: undefined };
  const kept = plan.days.filter((d: any) => !targetDays.includes(d.day));

  const beforeSummary = targetDays
    .map((name: string) => {
      const d = plan.days.find((x: any) => x.day === name);
      return d ? `${name} (${Math.round(dayProtein(d))}g protein, ${Math.round(dayCalories(d))} kcal)` : name;
    })
    .join(", ");
  const instructions =
    `${beforeSummary} came out with protein far below the rest of the week's ` +
    `${Math.round(plan.macros.protein_g)}g target. Rebuild ONLY ${targetDays.join(", ")} so each lands close to the same ` +
    `~${Math.round(plan.macros.protein_g)}g protein and ~${Math.round(plan.daily_calories)} kcal the other days already hit — ` +
    "add a proper protein source (egg, fish, paneer, dal) to whichever meal is currently thin on it, especially breakfast and dinner. " +
    "Do not reduce any meal that is already working; only add or upsize the protein-carrying items.";

  console.log("\nRebuilding Days 5-7...");
  const rebuilt = await generatePlanDays(
    { intake, week: 1, revision: { draft: plan, instructions } } as any,
    overview,
    targetDays,
    kept
  );

  const merged = plan.days.map((d: any) => rebuilt.find((r: any) => r.day === d.day) ?? d);
  const candidate = { ...plan, days: merged };

  console.log("Grounding the rebuilt days...");
  const cuisines = parseCuisines(intake.cuisines);
  const { plan: grounded, stats } = await groundPlan(supabase as any, candidate, cuisines);
  console.log(`  ${stats.grounded_meals}/${stats.total_meals} meals, ${stats.matched_items}/${stats.total_items} items`);

  const verdict = acceptRevision(plan, grounded);
  console.log(`\nVerdict: ${verdict.accept ? "ACCEPTED" : "REJECTED"} — ${verdict.reason}`);

  const finalPlan = verdict.accept ? grounded : plan;
  console.log("\nAfter:");
  for (const d of finalPlan.days.filter((d: any) => targetDays.includes(d.day))) {
    console.log(`  ${d.day}: ${Math.round(dayCalories(d))}kcal, protein=${Math.round(dayProtein(d))}g`);
  }
  const over = daysOverCeiling(finalPlan);
  if (over.length) console.log(`NOTE: ${over.length} day(s) still over ceiling: ${over.map((d: any) => d.day).join(", ")}`);

  if (!verdict.accept) {
    console.log("\nNot saving — the rebuild did not clear the same bar reconcileNutrition itself uses.");
    return;
  }

  await supabase.from("diet_plans").update({ plan: finalPlan }).eq("id", planId);
  console.log("\nSaved corrected plan.");

  console.log("\nRe-approving — regional naming + PDF...");
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
  writeFileSync(join(root, "kavya-week1-v2.pdf"), pdfBuffer);
  console.log(`PDF: ${join(root, "kavya-week1-v2.pdf")}`);
}

main();

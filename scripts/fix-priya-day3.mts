// Narrow follow-up: the Day2/Day3 correction pass (fix-priya-days-v2.mts)
// fixed Day 2 but overshot Day 3 badly — asked for more calories, the model
// added paneer/dal until Day 3 hit 2056 kcal / 94g protein (target ~1775/55g).
// Rebuilds ONLY Day 3, told explicitly to CUT BACK toward the target, and
// verified via acceptRevision() before saving — the same single-day
// precision that fixed Kavya's stubborn days.
//
// Run: npx tsx scripts/fix-priya-day3.mts <plan-id>
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
  console.error("Usage: npx tsx scripts/fix-priya-day3.mts <plan-id>");
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
  const cuisines = parseCuisines(intake.cuisines);

  const target = Math.round(plan.daily_calories);
  const proteinTarget = Math.round(plan.macros.protein_g);
  const day3 = plan.days.find((d: any) => d.day === "Day 3");
  console.log(`Before: Day 3: ${Math.round(dayCalories(day3))}kcal, protein=${Math.round(dayProtein(day3))}g (target ~${target}kcal, P${proteinTarget}g)`);

  const instructions =
    `Day 3 overshot badly on the last correction: it now carries ${Math.round(dayCalories(day3))} kcal and ` +
    `${Math.round(dayProtein(day3))}g protein against a ~${target} kcal, ${proteinTarget}g protein target — ` +
    "CUT IT BACK, do not add anything. Remove or shrink whichever protein-dense items (dal/paneer/curd) are " +
    "duplicated across meals — a single day should not carry dal AND paneer AND curd at large portions in the " +
    "same day. Bring both calories and protein down toward the target; a modest undershoot is fine, another " +
    "overshoot is not.";

  const overview = { ...plan, days: undefined };
  const kept = plan.days.filter((d: any) => d.day !== "Day 3");

  console.log("\nRebuilding Day 3 only...");
  const rebuilt = await generatePlanDays(
    { intake, week: 1, revision: { draft: plan, instructions } } as any,
    overview,
    ["Day 3"],
    kept
  );
  const merged = plan.days.map((d: any) => rebuilt.find((r: any) => r.day === d.day) ?? d);
  const candidate = { ...plan, days: merged };

  const { plan: grounded } = await groundPlan(supabase as any, candidate, cuisines);
  const verdict = acceptRevision(plan, grounded);
  console.log(`Verdict: ${verdict.accept ? "ACCEPTED" : "REJECTED"} — ${verdict.reason}`);

  const finalPlan = verdict.accept ? grounded : plan;
  const newDay3 = finalPlan.days.find((d: any) => d.day === "Day 3");
  console.log(`\nAfter: Day 3: ${Math.round(dayCalories(newDay3))}kcal, protein=${Math.round(dayProtein(newDay3))}g`);

  console.log("\nFull week:");
  for (const d of finalPlan.days) console.log(`  ${d.day}: ${Math.round(dayCalories(d))}kcal, protein=${Math.round(dayProtein(d))}g`);
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
  const pdfPath = `${client.dietitian_id}/${client.id}/week-${row.week_number}-fixedday3-${Date.now()}.pdf`;
  await supabase.storage.from("diet-pdfs").upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
  await supabase.from("diet_plans").update({ pdf_path: pdfPath }).eq("id", planId);
  writeFileSync(join(root, "priya-week1.pdf"), pdfBuffer);
  console.log(`PDF: ${join(root, "priya-week1.pdf")}`);
}

main();

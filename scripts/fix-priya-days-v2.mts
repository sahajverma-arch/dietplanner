// Second attempt at Priya's worst days. The generic reconcileNutrition() auto
// instructions failed twice (deviation 294 -> 463, then 294 -> 649) — the
// model kept shrinking calories further even when asked to raise them. This
// splits the four off-target days into their TWO distinct problems and gives
// each its own explicit, concrete instruction, the same way
// fix-kavya-protein-days.mts's precision succeeded where a blanket auto
// instruction didn't:
//   - Day 2, Day 3: calories 355-413 kcal SHORT of target, protein already
//     fine — need MORE food, not more protein.
//   - Day 6, Day 7: protein 20-22g OVER target, calories still slightly
//     short — swap the excess protein for carbs/fat (roti/rice/fruit), not
//     just cut it, so calories rise instead of falling further.
// Each group is rebuilt and verified separately via acceptRevision() before
// merging, so a group that doesn't help is dropped without discarding the
// other group's improvement.
//
// Run: npx tsx scripts/fix-priya-days-v2.mts <plan-id>
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
  console.error("Usage: npx tsx scripts/fix-priya-days-v2.mts <plan-id>");
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

async function rebuildGroup(
  plan: any,
  intake: any,
  cuisines: string[],
  targetDays: string[],
  instructions: string
): Promise<any> {
  const overview = { ...plan, days: undefined };
  const kept = plan.days.filter((d: any) => !targetDays.includes(d.day));

  console.log(`\nRebuilding ${targetDays.join(", ")}...`);
  const rebuilt = await generatePlanDays(
    { intake, week: 1, revision: { draft: plan, instructions } } as any,
    overview,
    targetDays,
    kept
  );
  const merged = plan.days.map((d: any) => rebuilt.find((r: any) => r.day === d.day) ?? d);
  const candidate = { ...plan, days: merged };

  const { plan: grounded } = await groundPlan(supabase as any, candidate, cuisines);
  const verdict = acceptRevision(plan, grounded);
  console.log(`Verdict: ${verdict.accept ? "ACCEPTED" : "REJECTED"} — ${verdict.reason}`);
  return verdict.accept ? grounded : plan;
}

async function main() {
  const { data: row } = await supabase.from("diet_plans").select("*").eq("id", planId).single();
  if (!row) throw new Error("Plan not found");
  let plan = row.plan as any;

  const { data: client } = await supabase.from("clients").select("id, full_name, dietitian_id, intake").eq("id", row.client_id).single();
  if (!client) throw new Error("Client not found");
  const intake = client.intake as any;
  const { data: profile } = await supabase.from("profiles").select("id, email, full_name").eq("id", client.dietitian_id).single();
  const cuisines = parseCuisines(intake.cuisines);

  console.log("Before:");
  for (const d of plan.days) console.log(`  ${d.day}: ${Math.round(dayCalories(d))}kcal, protein=${Math.round(dayProtein(d))}g`);

  const target = Math.round(plan.daily_calories);

  // Group 1: Day 2, Day 3 — calorie-short, protein already fine.
  plan = await rebuildGroup(
    plan,
    intake,
    cuisines,
    ["Day 2", "Day 3"],
    `Day 2 (${Math.round(dayCalories(plan.days.find((d: any) => d.day === "Day 2")))} kcal) and Day 3 ` +
      `(${Math.round(dayCalories(plan.days.find((d: any) => d.day === "Day 3")))} kcal) are both far short of the ` +
      `~${target} kcal daily target, while their protein (~56-57g) is already close to the ${Math.round(plan.macros.protein_g)}g target — ` +
      "the problem is total food volume, not protein. Enlarge the non-protein portions: bigger roti/rice servings, " +
      "more vegetables, add a fruit or nuts to a snack slot. Do not add more protein-dense items (dal/paneer/curd) — " +
      "protein is already correct on these two days; only carbs and fats need to go up."
  );

  // Group 2: Day 6, Day 7 — protein way over target, calories still short.
  plan = await rebuildGroup(
    plan,
    intake,
    cuisines,
    ["Day 6", "Day 7"],
    `Day 6 (${Math.round(dayProtein(plan.days.find((d: any) => d.day === "Day 6")))}g protein) and Day 7 ` +
      `(${Math.round(dayProtein(plan.days.find((d: any) => d.day === "Day 7")))}g protein) are both far OVER the ` +
      `${Math.round(plan.macros.protein_g)}g protein target, while calories are still slightly short of ~${target} kcal — ` +
      "SWAP, do not simply cut: shrink the oversized dal/paneer/curd portions (a lunch or dinner does not need both dal " +
      "AND a large paneer/curd side) and replace the removed calories with roti, rice, vegetables or fruit, so calories " +
      "do not fall further while protein comes down to the target."
  );

  console.log("\nAfter:");
  for (const d of plan.days) console.log(`  ${d.day}: ${Math.round(dayCalories(d))}kcal, protein=${Math.round(dayProtein(d))}g`);
  const over = daysOverCeiling(plan);
  if (over.length) console.log(`NOTE: ${over.length} day(s) still over ceiling: ${over.map((d: any) => d.day).join(", ")}`);

  await supabase.from("diet_plans").update({ plan }).eq("id", planId);
  console.log("\nSaved (whichever group(s) were accepted).");

  console.log("\nRe-approving — regional naming + PDF...");
  const pdfPlan = await regionalizePlan(supabase as any, plan, cuisines);
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
  const pdfPath = `${client.dietitian_id}/${client.id}/week-${row.week_number}-fixedv2-${Date.now()}.pdf`;
  await supabase.storage.from("diet-pdfs").upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
  await supabase.from("diet_plans").update({ pdf_path: pdfPath }).eq("id", planId);
  writeFileSync(join(root, "priya-week1.pdf"), pdfBuffer);
  console.log(`PDF: ${join(root, "priya-week1.pdf")}`);
}

main();

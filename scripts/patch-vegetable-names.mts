// Pure naming patch for an already-generated plan: bare vegetable names
// ("Bhindi", "Palak", "Cauliflower", "Lauki") that predate the exchangeBlock
// dish-naming fix become "<Name> sabzi" — an exact-match rename only, so
// legitimately-raw items in the same plan (Cucumber, Carrot, Tomato in a
// salad) are untouched. Macros/quantities are never touched: the underlying
// food and its grounding were always correct, only the display name was bare.
//
// Run: npx tsx scripts/patch-vegetable-names.mts <plan-id>
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
  console.error("Usage: npx tsx scripts/patch-vegetable-names.mts <plan-id>");
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BARE_VEG = new Set(["palak", "bhindi", "cauliflower", "lauki"]);

async function main() {
  const { data: row } = await supabase.from("diet_plans").select("*").eq("id", planId).single();
  if (!row) throw new Error("Plan not found");
  const plan = row.plan as any;

  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name, dietitian_id, intake")
    .eq("id", row.client_id)
    .single();
  if (!client) throw new Error("Client not found");
  const intake = client.intake as any;
  const { data: profile } = await supabase.from("profiles").select("id, email, full_name").eq("id", client.dietitian_id).single();

  let patched = 0;
  for (const day of plan.days) {
    for (const meal of day.meals) {
      for (const item of meal.items) {
        const key = String(item.food || "").trim().toLowerCase();
        if (BARE_VEG.has(key)) {
          const before = item.food;
          item.food = `${item.food.trim()} sabzi`;
          console.log(`${day.day} ${meal.name}: "${before}" -> "${item.food}"`);
          patched++;
        }
      }
    }
  }
  console.log(`\n${patched} item(s) patched.`);
  if (patched === 0) {
    console.log("Nothing to do.");
    return;
  }

  await supabase.from("diet_plans").update({ plan }).eq("id", planId);
  console.log("Saved.");

  console.log("\nRe-approving — regional naming + PDF...");
  const { regionalizePlan } = await import("../src/lib/regional-names");
  const { renderPlanPdf } = await import("../src/lib/pdf");
  const { parseCuisines } = await import("../src/lib/cuisines");

  const cuisines = parseCuisines(intake.cuisines);
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
  const pdfPath = `${client.dietitian_id}/${client.id}/week-${row.week_number}-vegpatch-${Date.now()}.pdf`;
  await supabase.storage.from("diet-pdfs").upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
  await supabase.from("diet_plans").update({ pdf_path: pdfPath }).eq("id", planId);
  writeFileSync(join(root, "kavya-week1-v2.pdf"), pdfBuffer);
  console.log(`PDF: ${join(root, "kavya-week1-v2.pdf")}`);
}

main();

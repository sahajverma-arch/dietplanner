// Full real pipeline, start to finish, for KAVYA (scripts/test-clients.ts) —
// non-vegetarian, Kerala-style, no allergies/conditions. Chosen for this run
// because her real food day (fish curry, prawn curry, egg curry, appam,
// puttu) exercises the regional-naming glossary's richest region: Fish,
// Fish curry, Rice, Curd, Buttermilk, Jaggery and Ghee are all confirmed for
// Kerala-style.
//
// Mirrors /api/generate-plan's "first" -> "approve" flow exactly (client
// insert, AI clinical review, generateDietPlan, groundPlan, nutrition
// reconcile, calorie-ceiling refusal check, draft save, then approve:
// regionalizePlan -> renderPlanPdf -> storage upload -> mark final) so the
// result is a REAL diet_plans row with a REAL PDF, visible in the running
// app at /clients/<id> — not a script-only simulation.
//
// Run: npx tsx scripts/create-kavya-plan.mts <dietitian-email>
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
  console.error("Usage: npx tsx scripts/create-kavya-plan.mts <dietitian-email>");
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { toIntake } = await import("../src/lib/counselling/assessment");
const { KAVYA } = await import("./test-clients");
const { aiClinicalReview, isPauseDecision, generateDietPlan } = await import("../src/lib/nim");
const { groundPlan } = await import("../src/lib/nutrition");
const { reconcileNutrition, daysOverCeiling } = await import("../src/lib/nutrition-reconcile");
const { auditPlan } = await import("../src/lib/match-audit");
const { regionalizePlan } = await import("../src/lib/regional-names");
const { renderPlanPdf } = await import("../src/lib/pdf");
const { parseCuisines } = await import("../src/lib/cuisines");

const toNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function main() {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .ilike("email", email)
    .maybeSingle();
  if (profileError || !profile) {
    console.error("Profile lookup failed:", profileError?.message ?? "not found");
    process.exit(1);
  }
  console.log(`Dietitian: ${profile.full_name || profile.email} (${profile.id})`);

  const intake = toIntake(KAVYA as any);
  console.log(`Client: ${intake.fullName} — ${intake.dietType}, cuisines: ${intake.cuisines}`);

  console.log("\n[1/6] AI clinical review...");
  const review = await aiClinicalReview(intake);
  console.log(`  decision: ${review.decision}`);
  if (isPauseDecision(review)) {
    console.log("  PAUSED:", review.missing_information);
    process.exit(1);
  }

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
  if (clientError) throw new Error(`Client insert failed: ${clientError.message}`);
  console.log(`  client created: ${client.id}`);

  console.log("\n[2/6] Generating week 1 (overview + 4 day batches)...");
  const t0 = Date.now();
  const startsOn = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  let plan = await generateDietPlan({ intake, week: 1, review, startsOn });
  console.log(`  generated in ${Math.round((Date.now() - t0) / 1000)}s`);

  console.log("\n[3/6] Grounding against public.foods (normal, blended — the real production path)...");
  const cuisines = parseCuisines(intake.cuisines);
  const grounded = await groundPlan(supabase as any, plan, cuisines);
  plan = grounded.plan;
  console.log(
    `  ${grounded.stats.grounded_meals}/${grounded.stats.total_meals} meals, ${grounded.stats.matched_items}/${grounded.stats.total_items} items ` +
      `(INDB ${grounded.stats.sources.INDB}, USDA ${grounded.stats.sources.USDA})`
  );

  console.log("\n[4/6] Nutrition reconcile...");
  const topup = await reconcileNutrition(supabase as any, plan, { intake, week: 1, review, startsOn });
  plan = topup.plan;
  console.log(`  ${topup.applied ? "applied" : "skipped"}: ${topup.reason}`);

  const over = daysOverCeiling(plan);
  if (over.length > 0) {
    console.log(`  REFUSED: ${over.length} day(s) over the calorie ceiling — ${over.map((d) => `${d.day} ${d.kcal} kcal`).join(", ")}`);
    process.exit(1);
  }

  console.log("\n[5/6] Match audit (observational)...");
  const flagged = (await auditPlan(supabase as any, plan)).filter((f: any) => f.verdict !== "ok");
  console.log(flagged.length ? `  ${flagged.length} item(s) to verify` : "  clean");

  const { data: planRow, error: planError } = await supabase
    .from("diet_plans")
    .insert({
      client_id: client.id,
      dietitian_id: profile.id,
      week_number: 1,
      source: "first_counselling",
      status: "draft",
      starts_on: startsOn,
      plan,
      ai_review: review,
    })
    .select("id")
    .single();
  if (planError) throw new Error(`Plan insert failed: ${planError.message}`);
  console.log(`  draft saved: ${planRow.id}`);

  // ---- approve: same as handleDraftReview's "approve" branch -------------
  console.log("\n[6/6] Approving — regional naming + PDF render (the real client-facing step)...");
  const pdfPlan = await regionalizePlan(supabase as any, plan, cuisines);

  // Prove the rename actually fired before spending a PDF render on it.
  const beforeNames = plan.days[0].meals.flatMap((m: any) => m.items.map((i: any) => i.food));
  const afterNames = pdfPlan.days[0].meals.flatMap((m: any) => m.items.map((i: any) => i.food));
  console.log("  Day 1 before:", beforeNames.join(", "));
  console.log("  Day 1 after: ", afterNames.join(", "));

  const pdfBuffer = await renderPlanPdf({
    plan: pdfPlan,
    clientName: intake.fullName,
    weekNumber: 1,
    dietitianName: profile.full_name || profile.email || "Your dietitian",
    generatedOn: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    startDateIso: startsOn,
    dietType: intake.dietType || "",
    cuisines: intake.cuisines,
    conditions: Array.isArray(intake.conditions) ? intake.conditions : [],
  });

  const pdfPath = `${profile.id}/${client.id}/week-1-${Date.now()}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("diet-pdfs")
    .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw new Error(`PDF upload failed: ${uploadError.message}`);

  await supabase.from("diet_plans").update({ status: "final", pdf_path: pdfPath }).eq("id", planRow.id);

  const localPath = join(root, "kavya-week1.pdf");
  writeFileSync(localPath, pdfBuffer);

  console.log(`\nDone. View in the app at: /clients/${client.id}`);
  console.log(`PDF also saved locally at: ${localPath}`);
  console.log(`Storage path: ${pdfPath}`);
}

main();

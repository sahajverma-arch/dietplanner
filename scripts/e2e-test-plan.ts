// End-to-end pipeline test: LeanR counselling answers → toIntake() →
// generateDietPlan() (NVIDIA NIM + forbidden-food enforcement) →
// groundPlan() (INDB/USDA foods table) → renderPlanPdf() → local PDF.
// Exercises exactly the code path of POST /api/generate-plan, minus the
// authenticated HTTP wrapper and DB/storage writes.
//
// Run: npx -y tsx scripts/e2e-test-plan.ts

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PRIYA, RAHUL } from "./test-clients";

// .env.local must be in process.env BEFORE the libs are imported (nim.ts reads
// NVIDIA_MODEL at module load), hence the dynamic imports in main().
const envPath = path.join(__dirname, "..", ".env.local");
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

async function main() {
  const { toIntake, redFlags, audit } = await import("../src/lib/counselling/assessment");
  const { missingRequired } = await import("../src/lib/counselling/questions");
  const { generateDietPlan, planWeekdays } = await import("../src/lib/nim");
  const { groundPlan } = await import("../src/lib/nutrition");
  const { renderPlanPdf } = await import("../src/lib/pdf");
  const { createClient } = await import("@supabase/supabase-js");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const outDir = path.join(__dirname, "..", "test-output");
  mkdirSync(outDir, { recursive: true });

  for (const [slug, answers] of [
    ["priya-test", PRIYA],
    ["rahul-test", RAHUL],
  ] as const) {
    const t0 = Date.now();
    console.log(`\n================ ${slug} ================`);

    // The same gate the API route enforces: every mandatory question answered.
    const missing = missingRequired(answers);
    if (missing.length > 0) {
      console.error(
        `!! ${missing.length} mandatory questions unanswered: ` +
          missing.map((m) => `${m.sectionTitle} — ${m.questionId}`).join("; ")
      );
      process.exit(1);
    }
    console.log("mandatory-question gate: all answered");

    const intake = toIntake(answers, null);
    const flags = redFlags(answers);
    const score = audit(answers);
    console.log(`intake: ${intake.fullName}, ${intake.age}y ${intake.gender}, ${intake.dietType}`);
    console.log(`conditions: ${intake.conditions.join(", ") || "none"}`);
    console.log(`allergies: ${intake.allergies || "none"} | dislikes: ${intake.dislikes || "none"}`);
    console.log(`red flags: ${flags.length ? flags.map((f) => f.label).join("; ") : "none"}`);
    console.log(`audit score: ${score.score}/100 (${score.band})`);

    console.log("generating plan (NVIDIA NIM, 2 calls)…");
    let plan = await generateDietPlan({ intake, week: 1, previousPlan: null, followup: null });
    console.log(
      `plan: ${plan.daily_calories} kcal/day, P${plan.macros.protein_g} C${plan.macros.carbs_g} F${plan.macros.fat_g}, ${plan.days.length} days`
    );

    try {
      const grounded = await groundPlan(supabase as any, plan);
      plan = grounded.plan;
      console.log(
        `grounding: ${grounded.stats.grounded_meals}/${grounded.stats.total_meals} meals, ` +
          `${grounded.stats.matched_items}/${grounded.stats.total_items} items ` +
          `(INDB ${grounded.stats.sources.INDB}, USDA ${grounded.stats.sources.USDA})`
      );
    } catch (e) {
      console.warn("grounding skipped:", e instanceof Error ? e.message : e);
    }

    // Safety spot-check: no forbidden term in any meal item.
    const forbidden = slug === "priya-test" ? ["peanut"] : ["lauki", "karela", "bottle gourd", "bitter gourd"];
    const hits: string[] = [];
    for (const day of plan.days)
      for (const meal of day.meals)
        for (const item of meal.items)
          for (const term of forbidden)
            if (item.food.toLowerCase().includes(term)) hits.push(`${day.day} ${meal.name}: ${item.food}`);
    console.log(hits.length ? `!! FORBIDDEN FOOD PRESENT: ${hits.join("; ")}` : "forbidden-food check: clean");

    // Day-of-week rules: Rahul's Tuesdays & Thursdays must be veg + egg-free.
    if (slug === "rahul-test") {
      const weekdays = planWeekdays();
      const nonveg = [
        "chicken", "fish", "mutton", "prawn", "shrimp", "seafood", "crab", "keema",
        "meat", "lamb", "pork", "beef", "egg", "omelette", "omelet",
      ];
      const dayHits: string[] = [];
      plan.days.forEach((day, i) => {
        if (weekdays[i] !== "Tuesday" && weekdays[i] !== "Thursday") return;
        for (const meal of day.meals)
          for (const item of meal.items)
            if (nonveg.some((t) => new RegExp(`\\b${t}s?\\b`, "i").test(item.food)))
              dayHits.push(`${day.day} (${weekdays[i]}) ${meal.name}: ${item.food}`);
      });
      const restrictedDays = plan.days
        .map((d, i) => `${d.day}=${weekdays[i]}`)
        .filter((_, i) => weekdays[i] === "Tuesday" || weekdays[i] === "Thursday");
      console.log(
        dayHits.length
          ? `!! DAY-RULE VIOLATION (${restrictedDays.join(", ")}): ${dayHits.join("; ")}`
          : `day-rule check (${restrictedDays.join(", ")} veg + egg-free): clean`
      );
    }

    const planStart = new Date();
    planStart.setDate(planStart.getDate() + 1);
    const pdfBuffer = await renderPlanPdf({
      plan,
      clientName: intake.fullName,
      weekNumber: 1,
      dietitianName: "sahaj.verma@fitelo.co",
      generatedOn: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      startDateIso: planStart.toISOString(),
      dietType: intake.dietType,
      conditions: intake.conditions,
    });

    const pdfPath = path.join(outDir, `${slug}-week1.pdf`);
    writeFileSync(pdfPath, pdfBuffer);
    writeFileSync(path.join(outDir, `${slug}-week1.plan.json`), JSON.stringify(plan, null, 2));
    console.log(`PDF: ${pdfPath} (${(pdfBuffer.length / 1024).toFixed(0)} KB, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }

  console.log("\nAll done.");
}

main().catch((e) => {
  console.error("\nE2E test failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});

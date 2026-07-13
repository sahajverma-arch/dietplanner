// End-to-end pipeline test: LeanR counselling answers → toIntake() →
// generateDietPlan() (NVIDIA NIM + forbidden-food enforcement) →
// groundPlan() (INDB/USDA foods table) → renderPlanPdf() → local PDF.
// Exercises exactly the code path of POST /api/generate-plan, minus the
// authenticated HTTP wrapper and DB/storage writes.
//
// Run: npx -y tsx scripts/e2e-test-plan.ts

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// .env.local must be in process.env BEFORE the libs are imported (nim.ts reads
// NVIDIA_MODEL at module load), hence the dynamic imports in main().
const envPath = path.join(__dirname, "..", ".env.local");
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

type Answers = Record<string, string | string[]>;

// ---------------------------------------------------------------------------
// Test client 1 — Priya Test: 32F, vegetarian, PCOS + hypothyroid,
// PEANUT ALLERGY (tests the allergen-must-never-appear enforcement).
// ---------------------------------------------------------------------------
const PRIYA: Answers = {
  name: "Priya Test",
  clientCode: "TEST-001",
  gender: "Female",
  phone: "+91 90000 00001",
  email: "priya.test@example.com",

  q2: ["Reduce body fat", "Reduce belly fat", "Improve energy"],
  q3: "Fit into old clothes and stay energetic through the workday",
  q4: "I want to reduce fat while maintaining muscle",
  q6: "Yes", q6a: "62",
  q8: ["No fixed date"],
  q11: "74", q12: "160", q13: "32",
  q14: "70", q16: "76",
  q21: "Weight gain after second pregnancy plus a desk job",
  q22: "Increased slightly",
  q25: "Yes", q26: "Stuck at 73-75 kg for 6 months despite daily walking",
  q30: "Body appearance",
  q37: "Higher body fat with low muscle",

  q41: ["PCOS/PCOD", "Hypothyroidism"],
  q44: "Well controlled",
  q46: "No",
  q49: "No", q50: "No", q53: "No", q54: "No", q55: "No",
  q56: "Yes",
  q57: "Thyronorm 50 mcg, empty stomach 6:30 am, daily, hypothyroid, 3 years",
  q61: "Only a weekly vitamin D3 sachet",
  q62: ["Vitamin D"],
  q68: "Within 3 months",
  q72: ["TSH borderline", "Vitamin D low"],
  q72a: "TSH 6.2 (Jan 2026), Vitamin D 18 ng/mL",

  q74: "07:00", q75: "Tea", q78: "Milk tea with 1.5 tsp sugar",
  q79: "09:00", q80: "2 aloo parathas with butter and a bowl of curd",
  q81: "2 medium parathas, 1 tsp butter, 1 katori curd",
  q82: ["Shallow fried"],
  q88: "2 biscuits with tea",
  q89: "13:30", q90: "3 rotis, aloo sabzi, dal, salad",
  q91: "3 rotis", q92: ["Dal"],
  q93: "Tea with 2 biscuits", q96: "Namkeen or bhujia while working",
  q102: "21:00", q103: "2 rotis with paneer sabzi or dal, rice sometimes",
  q104: "", q106: "Exactly my normal routine",
  q108: ["More restaurant food", "More sweets/snacks"],
  q109: "1–2",
  q111: ["North Indian", "Chinese"],
  q116: "Punjabi",
  q117: ["Wheat flour", "Rice", "Dal", "Paneer"],

  q121: "Vegetarian",
  q122: "Paneer, rajma, curd, poha, seasonal fruit",
  q123: "Lauki, tinda, raw sprouts",
  q124: "Yes",
  q124a: "Peanuts — hives and throat itching within minutes",
  q125: ["None"], q126: "",
  q129: "Avocado, quinoa",
  q130: "Anything needing more than 30 minutes",

  q131: "1", q132: "Rarely",
  q133: ["Paneer", "Dal", "Curd", "Rajma/beans"],
  q136: "No",
  q140: "Yes", q141: ["Not sure what to eat"], q142: "Open to trying",

  q143: "Yes", q144: ["Walking", "Yoga"], q145: "3", q147: "Morning",
  q148: "No strength training so far", q149: "Beginner",
  q151: "6", q152: "Fine, rarely sore", q154: "Stable",
  q156: "5,000–8,000", q157: "8–10", q158: "No", q159: [],
  q165: "3", q98: "Nothing", q100: "Nothing",

  q166: "Desk job", q167: "Hybrid", q168: "09:30 – 18:00", q169: "No shift",
  q171: "Evening", q172: "Evening snack", q174: "Yes",
  q175: "Self", q176: "Full kitchen", q178: "10–15 minutes", q179: "Twice weekly",
  q181: "Mostly household foods", q182: ["Exotic vegetables"],
  q183: ["Evening"], q185: "Fast", q186: "When the plate is empty",
  q189: ["Sweets", "Fried snacks"], q190: "Most evenings",
  q191: ["Stress", "Boredom"], q192: ["Snacking on namkeen"], q194: "Rarely",
  q197: ["Bloating"], q203: "No", q204: "No", q205: "No",
  q206: "1–1.5 L", q211: "23:30", q212: "07:00", q213: "6–7 hours", q214: "6",
  q219: "No", q221: "7",
  q231: "Yes", q232: "No", q233: "No",
  q236: "Occasionally", q239: "Never", q240: "2", q242: "Rarely",
  q245: "Weekly family dinner",

  q247: ["Keto", "Intermittent fasting"],
  q249: ["Too restrictive", "Results too slow"],
  q250: "Keto",
  q251: ["Needs structure"],
  q252: "Two options", q253: "Household measures",
  q255: ["Daily check-ins"],
  q256: "Evening cravings and weekend eating out",
  q257: "Evening namkeen cravings", q258: "Weekend eating out", q259: "Limited cooking time",
  q260: ["Morning tea", "Roti"],
  q262: "2–3 changes at a time", q263: "8", q265: "7",

  s_objective: "Fat Loss",
  s_gaps: ["Low Protein", "Poor Protein Distribution"],
  s_blocking: "Low protein, evening namkeen snacking and fried breakfasts despite good readiness",
  s_restrictions:
    "PEANUT ALLERGY — never include peanuts in any form. Thyroid tablet 6:30 am, breakfast after 7:15. PCOS — low-GI carbs.",
  s_p1: "Protein at breakfast and lunch",
  s_p2: "Replace evening namkeen with a planned snack",
  s_p3: "Cut shallow-fried breakfasts to twice a week",
  s_doctor: "No",
  pt_goal: "Fat loss with muscle preservation", pt_coord: "Yes",

  pl_structure: "Structured Meal Plan",
  pl_protein: "Paneer, dal, curd, Greek yogurt; clear protein at breakfast",
  pl_carb: "Keep roti at lunch; measured rice twice a week; low-GI focus for PCOS",
  pl_fat: "3 tsp oil per day, nothing deep-fried at home",
  pl_meals: "3 meals + snack",
  pl_meals_why: "Matches her routine; a planned evening snack replaces the namkeen habit",
  pl_priority1: "Protein breakfast (besan chilla / paneer poha) → full till lunch → count protein breakfasts per week",
  pl_priority2: "Evening snack swap to roasted chana or fruit → snack log",
  pl_priority3: "8,000 steps daily → step counter",
  pl_notes: "TEST CLIENT for end-to-end verification. The peanut allergy is the hard constraint.",
};

// ---------------------------------------------------------------------------
// Test client 2 — Rahul Test: 41M, non-vegetarian, type 2 diabetes +
// hypertension + high lipids, dislikes lauki/karela (tests dislike stripping
// and condition-adapted planning).
// ---------------------------------------------------------------------------
const RAHUL: Answers = {
  name: "Rahul Test",
  clientCode: "TEST-002",
  gender: "Male",
  phone: "+91 90000 00002",
  email: "rahul.test@example.com",

  q2: ["Reduce belly fat", "Gain muscle", "Improve health markers"],
  q3: "Bring HbA1c under 6.5 and lose the belly",
  q4: "I want to lose fat and gain muscle",
  q6: "Yes", q6a: "78",
  q8: ["Medical recommendation"],
  q11: "92", q12: "175", q13: "41",
  q14: "89", q16: "94",
  q21: "Sedentary job, late dinners and weekend drinking over the last five years",
  q22: "Increased slightly",
  q25: "No",
  q30: "Health markers",
  q37: "Higher body fat with low muscle",

  q41: ["Diabetes", "Hypertension", "High cholesterol/triglycerides"],
  q44: "Partially controlled",
  q46: "No",
  q49: "No", q50: "No", q53: "No", q54: "No", q55: "No",
  q56: "Yes",
  q57: "Metformin 500 mg after breakfast and dinner; Telmisartan 40 mg morning; Rosuvastatin 10 mg night",
  q61: "None",
  q68: "Within 3 months",
  q72: ["HbA1c high", "LDL high", "Triglycerides high"],
  q72a: "HbA1c 7.8, LDL 148, TG 210 (Jun 2026)",
  d1: "7.8", d5: "Rarely",

  q74: "07:30", q75: "Tea", q78: "Milk tea with sweetener",
  q79: "09:30", q80: "2 slices white bread with butter and 2 boiled eggs",
  q81: "2 slices, 2 eggs",
  q82: ["Boiled"],
  q88: "Tea",
  q89: "14:00", q90: "Office canteen: 3 rotis, chicken curry or dal, rice, salad",
  q91: "3 rotis + 1 katori rice", q92: ["Chicken", "Dal"],
  q93: "Tea with rusk", q96: "Samosa or pakora from the canteen twice a week",
  q102: "22:00", q103: "2 rotis, sabzi, sometimes chicken",
  q104: "Ice cream on weekends", q106: "Mostly normal",
  q108: ["More restaurant food", "More alcohol"],
  q109: "3–5",
  q111: ["North Indian", "Mughlai"],
  q116: "Punjabi",
  q117: ["Wheat flour", "Rice", "Chicken", "Eggs"],

  q121: "Non-vegetarian",
  q122: "Chicken, eggs, fish, rajma, curd",
  q123: "Lauki, karela, tinda",
  q124: "No",
  q125: ["None"], q126: "",

  q131: "2", q132: "Daily",
  q133: ["Dal", "Curd", "Paneer"],
  q136: "Yes", q137: "2 whole eggs daily",
  q138: ["Chicken", "Fish"], q139: "2–3 times/week",
  q140: "Yes", q142: "Used whey before, stopped",

  q143: "Starting with LeanR", q145: "0",
  q148: "Tried a gym for a few months years ago",
  q151: "5", q156: "2,000–5,000", q157: "More than 10", q158: "No", q159: [],
  q165: "4", q98: "Nothing", q100: "Nothing",

  q166: "Desk job", q167: "Office", q168: "10:00 – 19:30", q169: "Fixed day",
  q171: "Night", q172: "Office canteen lunch", q174: "Yes",
  q175: "Spouse", q176: "Full kitchen", q178: "Maximum 5 minutes", q179: "No",
  q181: "Can add a few fitness foods",
  q183: ["Late night"], q185: "Fast", q186: "When I feel full",
  q189: ["Sweets", "Ice cream"], q191: ["Stress"], q192: ["Late-night snacking"], q194: "Rarely",
  q197: ["Acidity/reflux"], q203: "No", q204: "No", q205: "No",
  q206: "2–3 L", q211: "00:30", q212: "07:30", q213: "6–7 hours", q214: "5",
  q219: "No", q221: "8",
  q236: "Weekly", q237: "Whisky, 2-3 drinks on weekends",
  q239: "Never", q240: "3",
  q242: "Monthly", q243: "Domestic", q244: ["Restaurant meals"],
  q245: "Client dinners twice a month",

  q247: ["Trainer's gym diet"],
  q249: ["Work travel broke the routine"],
  q251: ["Flexible options"],
  q252: "Flexible exchange system",
  q255: ["Weekly review"],
  q256: "Late dinners, canteen lunches and weekend alcohol",
  q257: "Late office hours", q258: "Canteen food", q259: "Weekend alcohol",
  q260: ["Morning tea", "Rice", "Restaurant meal"],
  q262: "2–3 changes at a time", q263: "7", q265: "6",
  q266: "Simple options I can actually get in the office",

  s_objective: "Body Recomposition",
  s_gaps: ["Long Meal Gaps", "High Liquid Calories", "Poor Workout Nutrition"],
  s_blocking: "Late dinners, canteen lunches, weekend alcohol and very low activity; diabetes only partially controlled",
  s_restrictions: "Diabetic — low-GI, no added sugar. Hypertension — keep sodium moderate. On a statin.",
  s_p1: "Dinner by 21:30",
  s_p2: "Low-GI carb swaps at lunch",
  s_p3: "Protein at every meal",
  s_doctor: "Yes",
  pt_goal: "Muscle gain with fat loss", pt_coord: "Yes",

  pl_structure: "Flexible Meal Option Plan",
  pl_protein: "Eggs at breakfast; chicken, fish or dal at lunch and dinner; curd daily",
  pl_carb: "Keep measured rice at lunch, whole grain instead of white bread, low-GI overall",
  pl_fat: "Fried canteen snacks max once a week; 3 tsp oil/day at home",
  pl_meals: "3 meals + snack",
  pl_meals_why: "Long office hours — a structured evening snack prevents the late-night eating",
  pl_priority1: "Dinner by 21:30 → smaller earlier meals with spouse's support → HbA1c recheck in 3 months",
  pl_priority2: "Canteen strategy: roti + chicken/dal + salad, rice only on training days",
  pl_priority3: "8,000 steps plus 3 strength sessions per week",
  pl_notes: "TEST CLIENT for end-to-end verification. Diabetes + hypertension: low-GI, moderate sodium.",
};

// ---------------------------------------------------------------------------

async function main() {
  const { toIntake, redFlags, audit } = await import("../src/lib/counselling/assessment");
  const { generateDietPlan } = await import("../src/lib/nim");
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

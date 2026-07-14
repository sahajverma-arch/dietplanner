// QA tool for the LeanR Premium counselling: builds a filled assessment,
// prints the red flags and the quality audit score, shows the exact profile
// the AI receives, runs the AI INDEPENDENT CLINICAL REVIEW (support/modify/
// pause decision), then generates + grounds a real plan.
// Run: npx tsx scripts/test-clinical-counselling.mts
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { PRIYA } from "./test-clients";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

const { redFlags, audit, toIntake, aiProfile } = await import("../src/lib/counselling/assessment");
const { visibleSections, visibleQuestions, missingRequired } = await import(
  "../src/lib/counselling/questions"
);
const { generateDietPlan, aiClinicalReview, isPauseDecision } = await import("../src/lib/nim");
const { groundPlan } = await import("../src/lib/nutrition");

// Priya Test: 32F vegetarian, PCOS + hypothyroid, PEANUT ALLERGY (severe),
// restriction-regain history — trips the allergy red flag and exercises the
// clinical branches of the LeanR Premium bank.
const answers = PRIYA;

// --- what the dietitian sees live -----------------------------------------
const missing = missingRequired(answers);
console.log("=== MANDATORY-QUESTION GATE ===");
console.log(
  missing.length
    ? `!! ${missing.length} unanswered: ${missing.map((m) => m.questionId).join(", ")}`
    : "all mandatory questions answered"
);

const flags = redFlags(answers);
const score = audit(answers);
const sections = visibleSections(answers);

console.log("\n=== SECTIONS ACTIVE ===");
console.log(
  sections.map((s) => `${s.title} (${visibleQuestions(s, answers).length})`).join(" · ")
);
console.log("\n=== RED FLAGS ===");
if (!flags.length) console.log("none");
flags.forEach((f) => console.log(` ${f.escalate ? "ESCALATE" : "caution "} ${f.label} → ${f.action}`));

console.log("\n=== COUNSELLING SCORE ===");
console.log(`${score.score}/100 — ${score.band}`);
score.categories.forEach((c) =>
  console.log(`  ${c.name.padEnd(32)} ${c.earned}/${c.max}${c.missing.length ? "  missing: " + c.missing.join(", ") : ""}`)
);

const intake = toIntake(answers, null);
console.log("\n=== LEGACY MAPPING (clients table) ===");
console.log(JSON.stringify(
  { fullName: intake.fullName, age: intake.age, dietType: intake.dietType, goal: intake.goal, conditions: intake.conditions, allergies: intake.allergies },
  null, 0
));

const profile = aiProfile(answers);
console.log("\n=== AI PROFILE (keys) ===");
console.log(Object.keys(profile).join(", "));
console.log("prompt size:", JSON.stringify(profile).length, "chars");

// --- AI independent clinical review ----------------------------------------
console.log("\nRunning AI independent clinical review…");
let review: Awaited<ReturnType<typeof aiClinicalReview>> | null = null;
for (let i = 1; i <= 3 && !review; i++) {
  try {
    review = await aiClinicalReview(intake);
  } catch (e) {
    console.log(`  attempt ${i} failed: ${e instanceof Error ? e.message.slice(0, 80) : e}`);
  }
}
if (review) {
  console.log("=== AI CLINICAL REVIEW ===");
  console.log(`decision: ${review.decision}`);
  console.log(`reasoning: ${review.reasoning}`);
  if (review.strategy_adjustments.length)
    console.log(`adjustments:\n  - ${review.strategy_adjustments.join("\n  - ")}`);
  if (review.safety_concerns.length)
    console.log(`safety:\n  - ${review.safety_concerns.join("\n  - ")}`);
  if (isPauseDecision(review)) {
    console.log(`PAUSED — missing: ${review.missing_information.join("; ")}`);
    console.log("(the API route would return 422 here and keep the counselling as a draft)");
    process.exit(0);
  }
} else {
  console.log("review unavailable — generating without it (same as the API fallback)");
}

// --- real plan -------------------------------------------------------------
console.log("\nGenerating plan from the clinical assessment…");
const t0 = Date.now();
let plan: any = null;
for (let i = 1; i <= 4 && !plan; i++) {
  try {
    plan = await generateDietPlan({ intake, week: 1, review });
  } catch (e) {
    console.log(`  attempt ${i} failed: ${e instanceof Error ? e.message.slice(0, 80) : e}`);
  }
}
if (!plan) throw new Error("NIM unavailable");
console.log(`Generated in ${Math.round((Date.now() - t0) / 1000)}s`);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
const { plan: grounded, stats } = await groundPlan(supabase as any, plan);

console.log("\n=== PLAN ===");
console.log(`${grounded.summary}\n`);
console.log(`Target ${grounded.daily_calories} kcal · P${grounded.macros.protein_g} C${grounded.macros.carbs_g} F${grounded.macros.fat_g}`);
console.log("grounding:", JSON.stringify(stats));
for (const day of grounded.days.slice(0, 2)) {
  console.log(`\n${day.day} (${day.total_calories} kcal)`);
  for (const m of day.meals) {
    console.log(`  ${m.time} ${m.name.padEnd(16)} ${String(m.calories).padStart(4)} kcal | ${m.items.map((i: any) => `${i.food} [${i.quantity}]`).join(", ")}`);
  }
}

// --- did the AI honour the counselling? ------------------------------------
// Only the MEALS may be checked — foods_to_avoid legitimately names the
// disliked foods, so scanning the whole plan gives false failures.
const meals = JSON.stringify(grounded.days).toLowerCase();
console.log("\n=== ADHERENCE TO THE COUNSELLING (meals only) ===");
const checks: [string, boolean][] = [
  ["Excludes peanut (SEVERE ALLERGY)", !/peanut|groundnut/.test(meals)],
  ["Excludes lauki/bottle gourd (will not eat)", !/lauki|bottle gourd/.test(meals)],
  ["Excludes karela/tinda (will not eat)", !/karela|bitter gourd|tinda/.test(meals)],
  ["Keeps roti (non-negotiable)", /roti|chapati/.test(meals)],
  ["Keeps tea (non-negotiable)", /tea|chai/.test(meals)],
  ["No meat/fish/egg (vegetarian)", !/chicken|mutton|fish|\begg/.test(meals)],
  ["Protein at breakfast (dietitian priority)", /paneer|curd|dal|besan|sprout|milk|yogurt|moong/.test(
    JSON.stringify(grounded.days[0].meals[0]).toLowerCase()
  )],
  ["Every day within ±20% of target", grounded.days.every(
    (d: any) => Math.abs((d.total_calories ?? 0) - grounded.daily_calories) / grounded.daily_calories <= 0.2
  )],
];
checks.forEach(([label, ok]) => console.log(` ${ok ? "PASS" : "FAIL"}  ${label}`));

// QA tool for the LeanR clinical counselling: builds a filled assessment,
// prints the red flags and the Part 11 audit score, shows the exact profile the
// AI receives, then generates + grounds a real plan.
// Run: npx tsx scripts/test-clinical-counselling.mts
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

const { redFlags, audit, toIntake, aiProfile } = await import("../src/lib/counselling/assessment");
const { visibleSections, visibleQuestions } = await import("../src/lib/counselling/questions");
const { generateDietPlan } = await import("../src/lib/nim");
const { groundPlan } = await import("../src/lib/nutrition");

// A realistic vegetarian PCOS client with a night-shift-free desk job, plus a
// hypoglycaemia-free diabetes-adjacent picture — enough to trip branches.
const answers: Record<string, string | string[]> = {
  name: "Priya Sharma", gender: "Female", phone: "9876543210", clientCode: "493254845",

  q1: "Wedding in 6 months and clothes stopped fitting.",
  q2: ["Reduce body fat", "Improve energy", "Improve health markers"],
  q3: "Fit into my old clothes and stop feeling tired by 4pm.",
  q4: "I want to reduce fat while maintaining muscle",
  q5: ["Lower abdomen", "Love handles"],
  q6: "Yes", q6a: "68", q7: "I was 68 kg before my PCOS diagnosis.",
  q8: ["Wedding"], q9: "9", q10: "Because my health markers are worsening.",

  q11: "78", q12: "163", q13: "32", q14: "72", q16: "80", q19: "After PCOS diagnosis in 2023",
  q20: "Gradual", q21: ["Desk job", "Stress", "Medical diagnosis"], q22: "Increased slightly",
  q23: "Very easily", q24: "Very difficult", q25: "Yes", q26: "1–3 months", q27: "Yes",
  q28: "Not sure", q29: "Increased", q30: "Overall combination",

  q31: "Yes", q32: "Smart scale", q33: "38% — May 2026", q37: "Higher body fat with low muscle",
  q38: "Yes", q39: "No",

  q41: ["PCOS/PCOD", "Insulin resistance", "Vitamin D deficiency"],
  q42: "Specialist", q43: "2023", q44: "Partially controlled", q45: "Yes",
  q46: "No", q47: "No", q48: "No",
  q49: "No", q50: "No", q51: "Sometimes", q52: "No", q53: "No", q54: "No", q55: "No",

  q56: "Yes", q57: "Metformin 500 mg · after breakfast and dinner · daily · PCOS · 2 years",
  q58: "No", q59: "Sometimes", q60: ["None"],

  q61: "Yes", q62: ["Vitamin D", "Multivitamin"], q63: "Doctor", q64: "60k IU weekly",
  q65: "Daily", q66: ["None"], q67: "No",

  q68: "Within 3 months", q69: "Yes", q70: "Medical condition", q71: "Yes",
  q72: ["Blood glucose", "Vitamin D", "Triglycerides"],
  q72a: "Fasting glucose 108, HbA1c 5.9, Vit D 14, TG 180",
  q73: "Yes",

  // Diabetes branch (insulin resistance activates it)
  d1: "5.9 — June 2026", d2: "Fasting 108", d3: "No", d5: "Never", d6: "No",
  d9: "Carb-heavy breakfast, long gap before lunch", d10: "Occasionally", d11: "No",
  // PCOS branch
  p1: "2023, ultrasound + bloods", p2: "Yes", p3: "HbA1c 5.9, TG 180",
  p4: "Metformin 500 mg BD", p5: "Gained 8 kg since diagnosis",
  p6: "Tried keto for 2 months — lost weight, regained after stopping",

  q74: "07:00", q75: "Tea", q76: "None", q77: "Tea",
  q78: "1 cup, 100 ml toned milk, 1.5 tsp sugar",
  q79: "09:00", q80: "2 aloo parathas with butter and curd", q81: "2 parathas, 1 katori curd",
  q82: ["Shallow fried"], q83: "Family", q84: "7", q85: "8", q86: "Mostly",
  q87: ["Using phone"], q88: "Tea with 2 biscuits at 11:30",
  q89: "14:30", q90: "3 rotis, dal, aloo sabzi, curd, salad", q91: "3 rotis",
  q92: ["Dal", "Curd"], q93: "Tea at 17:00 with namkeen",
  q94: "Daily", q95: ["Sweet", "Fried food"],
  q96: "Namkeen and tea", q97: "Yes",
  q98: "Nothing", q99: ["Water"], q100: "Nothing until dinner", q101: "More than 2 hours",
  q102: "22:00", q103: "2 rotis, paneer sabzi, rice half katori", q104: "",
  q105: "23:30", q106: "Mostly normal", q107: "Weekends I skip breakfast",

  q108: ["Much heavier", "More restaurant food"], q109: "3–5", q110: "2–3 times/week",
  q111: ["North Indian", "Chinese"], q112: "4", q113: "Sometimes",
  q114: "Pizza and dessert on Sunday",

  q115: "India, Delhi", q116: "Punjabi",
  q117: ["Roti", "Rice", "Paratha"], q118: "Easily", q119: "No", q120: "Weekly",

  q121: "Vegetarian",
  q122: "Paneer, dal, curd, seasonal fruits, poha",
  q123: "Bottle gourd (lauki), karela, oats",
  q124: "No",
  q125: ["None"], q126: "Rajma causes bloating",
  q127: "Boiled vegetables from an old plan",
  q128: "Almonds daily", q129: "", q130: "Tofu dishes",

  q131: "2", q132: "Rarely",
  q133: ["Paneer", "Curd", "Dal", "Milk"], q134: "2–3 times/week", q135: "Yes",
  q136: "No", q140: "Yes", q141: ["Don't know what to eat", "Vegetarian diet"],
  q142: "Need more information",

  q143: "Yes", q144: ["Walking"], q145: "3", q146: "30–45 min", q147: "Evening",
  q148: "Never", q149: "Complete beginner", q150: ["None"], q151: "5",
  q152: "Average", q153: "1–2 days", q154: "Don't track", q155: "Sometimes",
  q156: "2,000–5,000", q157: "8–10",

  q158: "No", q162: "No", q163: "Home", q164: ["Resistance bands", "No equipment"], q165: "4",

  q166: "Desk job", q167: "Hybrid", q168: "09:30 – 18:30", q169: "Fixed day",
  q170: "Wake 7, tea, work from 9:30, lunch at desk, walk in evening, dinner late",
  q171: "Evening", q172: "Evening snack", q173: "Usually", q174: "Yes",

  q175: "Family", q176: "Full kitchen", q177: "Yes", q178: "10–15 minutes", q179: "Twice weekly",
  q180: "6",

  q181: "Mostly household foods", q182: ["Greek yogurt", "Protein powder"],

  q183: ["Evening", "Late night"], q184: "7", q185: "10–15 minutes", q186: "Very full",
  q187: "Sometimes", q188: "Paneer meals",

  q189: ["Sweet", "Fried food"], q190: "Daily", q191: ["Stress", "Work pressure", "Habit"],
  q192: ["Eat more", "Crave sweets"], q193: "Sometimes", q194: "Rarely", q195: "Rarely",
  q196: "Sometimes",

  q197: ["Bloating", "Acidity"], q198: "Few times/week", q199: ["After lunch"],
  q200: "Every 2 days", q201: "Sometimes", q202: "Rarely", q203: "No", q204: "No", q205: "No",

  q206: "1–1.5 L", q207: "Minimal", q208: "No", q209: "Never", q210: "No",

  q211: "23:30", q212: "07:00", q213: "6–7 hours", q214: "5", q215: "15–30 minutes",
  q216: "Sometimes", q217: "No", q218: "No", q219: "No", q220: "Frequently",

  q221: "7", q222: "Work", q223: "Moderately", q224: "I skip workouts", q225: "Less than 30 min",

  q226: "Yes", q227: "No", q228: "More than 35 days", q229: "No", q230: "Yes",
  q231: "Yes", q232: "No", q233: "No", q234: "Not applicable", q235: "Yes",

  q236: "Occasionally", q237: "Wine, 1-2 glasses", q238: "Snacks",
  q239: "Never", q240: "3", q241: "3–6 PM",

  q242: "Rarely", q245: "2–3 times/month",

  q246: "Yes", q247: ["Keto", "Intermittent fasting"], q248: "Keto — lost 4 kg",
  q249: ["Could not sustain", "Too restrictive"], q250: "Keto — no rice or roti at all",

  q251: ["Need flexibility", "Struggle on weekends"], q252: "Two options",
  q253: "Cups/katoris", q254: "Few days/week", q255: ["Simple instructions", "Regular feedback"],

  q256: ["Cravings", "Stress", "Time", "Eating out"], q257: "Cravings", q258: "Stress", q259: "Time",

  q260: ["Morning tea", "Roti", "Rice", "Family dinner"],
  q261: "Willing to change breakfast and evening snack",
  q262: "3–4 structured changes", q263: "8", q265: "7",

  s_objective: "Fat Loss", s_primary: "Fat loss with muscle preservation, PCOS-friendly",
  s_secondary: "Improve insulin sensitivity", s_timeline: "6 months to wedding",
  s_restrictions: "Low-GI carbs, no aggressive deficit (PCOS + metformin)",
  s_doctor: "No",
  s_gaps: ["Low Protein", "Poor Protein Distribution", "Long Meal Gaps", "Poor Hydration", "Poor Workout Nutrition"],
  s_blocking: "Carb-heavy low-protein breakfast, 5h meal gaps, evening stress cravings, only 3k steps",
  s_p1: "Protein at every meal, starting with breakfast",
  s_p2: "Close the 11:30–14:30 gap with a planned protein snack",
  s_p3: "Evening craving strategy — planned snack instead of namkeen",

  pl_structure: "Flexible Meal Option Plan",
  pl_protein: "Paneer/curd/dal at each meal; breakfast protein is priority 1; 2 options per meal",
  pl_carb: "Keep roti and rice (non-negotiable) but low-GI and portion-controlled; no keto",
  pl_fat: "Reduce shallow-fry; nuts as measured portion",
  pl_meals: "3 meals + snack", pl_meals_why: "Long gaps drive evening cravings",
  pl_priority1: "Breakfast: swap 2 aloo parathas for 1 paratha + paneer bhurji · measure by katori · success = protein at breakfast 6/7 days",
  pl_priority2: "Mid-afternoon planned snack (curd/sprouts) · success = no namkeen at 17:00",
  pl_priority3: "Walk 15 min after dinner · success = 6k steps average",
  pl_notes: "Client hates lauki, karela and oats — never include. Keep morning tea.",

  pt_goal: "Fat loss with muscle preservation; start resistance training at home",
  pt_observe: "Complete beginner — form first; low workout energy (5/10)",
  pt_coord: ["Fat loss", "Low energy", "Post-workout meal", "Medical consideration"],
  pt_concern: "Trains fasted in the evening and eats nothing until 22:00 dinner",
};

// --- what the dietitian sees live -----------------------------------------
const flags = redFlags(answers);
const score = audit(answers);
const sections = visibleSections(answers);

console.log("=== SECTIONS ACTIVE ===");
console.log(
  sections.map((s) => `${s.title} (${visibleQuestions(s, answers).length})`).join(" · ")
);
console.log("\n=== RED FLAGS ===");
if (!flags.length) console.log("none");
flags.forEach((f) => console.log(` ${f.escalate ? "ESCALATE" : "caution "} ${f.label} → ${f.action}`));

console.log("\n=== COUNSELLING SCORE ===");
console.log(`${score.score}/100 — ${score.band}`);
score.categories.forEach((c) =>
  console.log(`  ${c.name.padEnd(28)} ${c.earned}/${c.max}${c.missing.length ? "  missing: " + c.missing.join(", ") : ""}`)
);

const intake = toIntake(answers, null);
console.log("\n=== LEGACY MAPPING (clients table) ===");
console.log(JSON.stringify(
  { fullName: intake.fullName, age: intake.age, dietType: intake.dietType, goal: intake.goal, conditions: intake.conditions },
  null, 0
));

const profile = aiProfile(answers);
console.log("\n=== AI PROFILE (keys) ===");
console.log(Object.keys(profile).join(", "));
console.log("prompt size:", JSON.stringify(profile).length, "chars");

// --- real plan -------------------------------------------------------------
console.log("\nGenerating plan from the clinical assessment…");
const t0 = Date.now();
let plan: any = null;
for (let i = 1; i <= 4 && !plan; i++) {
  try {
    plan = await generateDietPlan({ intake, week: 1 });
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
  ["Excludes lauki/bottle gourd (disliked)", !/lauki|bottle gourd/.test(meals)],
  ["Excludes karela (disliked)", !/karela|bitter gourd/.test(meals)],
  ["Excludes oats (disliked)", !/oats|oatmeal/.test(meals)],
  ["Keeps roti/rice (non-negotiable)", /roti|chapati|rice/.test(meals)],
  ["Keeps morning tea (non-negotiable)", /tea|chai/.test(meals)],
  ["No meat/fish/egg (vegetarian)", !/chicken|mutton|fish|\begg/.test(meals)],
  ["Protein at breakfast (priority 1)", /paneer|curd|dal|besan|sprout|milk|yogurt/.test(
    JSON.stringify(grounded.days[0].meals[0]).toLowerCase()
  )],
  ["Every day within ±20% of target", grounded.days.every(
    (d: any) => Math.abs((d.total_calories ?? 0) - grounded.daily_calories) / grounded.daily_calories <= 0.2
  )],
];
checks.forEach(([label, ok]) => console.log(` ${ok ? "PASS" : "FAIL"}  ${label}`));

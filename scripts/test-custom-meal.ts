// End-to-end test of the dietitian's hand-written meal: free text →
// parseMealText() (structuring only, no invention) → groundMeals() (real
// macros from the foods table). The code path of POST /api/plan-meal
// {type:"custom"} minus the HTTP wrapper.
//
// The failure that matters is a parser that QUIETLY EDITS the dietitian: drops
// a food, adds one they did not write, or silently rewrites a quantity. Each
// case below therefore asserts the foods that came back, not just that it ran.
//
// Run: npx -y tsx scripts/test-custom-meal.ts

import { readFileSync } from "node:fs";
import path from "node:path";
import { AADI } from "./test-clients";

const envPath = path.join(__dirname, "..", ".env.local");
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

// [what the dietitian types, foods that MUST appear, foods that must NOT]
const CASES: [string, string[], string[]][] = [
  ["2 roti, paneer bhurji 1 katori, curd 1 katori", ["roti", "paneer", "curd"], []],
  ["1 bowl poha with peanuts and a glass of milk", ["poha", "milk"], []],
  // No quantities at all — every item must still come back with a portion.
  ["idli sambar and coconut chutney", ["idli", "sambar"], []],
  // A trailing instruction belongs in notes, never as a food.
  ["moong dal chilla 2, mint chutney, no oil", ["chilla", "chutney"], ["oil"]],
];

async function main() {
  const { toIntake } = await import("../src/lib/counselling/assessment");
  const { parseMealText } = await import("../src/lib/nim");
  const { groundMeals } = await import("../src/lib/nutrition");
  const { createClient } = await import("@supabase/supabase-js");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const intake = toIntake(AADI);
  let failed = 0;

  for (const [text, must, mustNot] of CASES) {
    console.log(`\n--- "${text}"`);
    const parsed = await parseMealText({ intake, text, mealName: "Lunch" });
    const grounded = await groundMeals(supabase, [
      { name: "Lunch", time: "13:30", ...parsed, alternates: [] },
    ]);
    const priced = grounded.meals[0];
    const unmatched = grounded.unpriced[0];

    const foods = priced.items.map((i) => i.food.toLowerCase());
    const joined = foods.join(" | ");
    for (const item of priced.items) {
      console.log(`    ${item.food} — ${item.quantity || "(NO QUANTITY)"}`);
    }
    if (priced.notes) console.log(`    notes: ${priced.notes}`);
    console.log(
      `    ${Math.round(priced.calories)} kcal · P ${Math.round(priced.protein_g)} · ` +
        `C ${Math.round(priced.carbs_g)} · F ${Math.round(priced.fat_g)}`
    );

    // The route reports these to the dietitian, because an unpriced food
    // contributes ZERO and would otherwise make a real meal look like a snack.
    if (unmatched.length) {
      console.log(`    warns dietitian — excluded from the totals: ${unmatched.join(", ")}`);
    }

    const missing = must.filter((m) => !joined.includes(m));
    const invented = mustNot.filter((m) => joined.includes(m));
    const noQty = priced.items.filter((i) => !i.quantity.trim()).map((i) => i.food);

    if (missing.length) { failed++; console.log(`    FAIL dropped: ${missing.join(", ")}`); }
    if (invented.length) { failed++; console.log(`    FAIL invented: ${invented.join(", ")}`); }
    if (noQty.length) { failed++; console.log(`    FAIL no quantity: ${noQty.join(", ")}`); }
    if (priced.calories <= 0) { failed++; console.log(`    FAIL priced at 0 kcal`); }
    if (!missing.length && !invented.length && !noQty.length && priced.calories > 0) {
      console.log(`    ok`);
    }
  }

  console.log(failed === 0 ? `\nall custom-meal checks pass` : `\n${failed} FAILURES`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

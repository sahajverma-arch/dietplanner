// Regression test for the vessel-unit backstop — after PORTION_GUIDE and
// rule 7 were edited to require grams/ml/plain-count/tbsp/tsp instead of
// katori/cup/bowl/plate/glass/handful, a live run still wrote 26/119 items
// (22%) as "1 cup" or "1 katori" (mostly Rice and Filter coffee). This pins
// the deterministic check added to catch what the prompt instruction alone
// didn't.
//
// Run: npx -y tsx scripts/tests/quantity-units.test.mts
import { quantityUnitIssues } from "../../src/lib/nim";
import type { DietPlan } from "../../src/lib/nim";

let failed = 0;
const check = (name: string, pass: boolean, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${name.padEnd(60)}${detail}`);
};

const meal = (name: string, items: { food: string; quantity: string }[]) => ({
  name, time: "", items, notes: "",
  calories: 400, protein_g: 20, carbs_g: 40, fat_g: 10, alternates: [],
});
const day = (name: string, meals: ReturnType<typeof meal>[]): DietPlan["days"][number] => ({
  day: name, total_calories: 2000, meals,
});

// --- 1. Vessel units are flagged, by name -----------------------------------
const cupRice = quantityUnitIssues([
  day("Day 1", [meal("Breakfast", [{ food: "Rice", quantity: "1 cup" }])]),
]);
check(
  "\"1 cup\" is flagged",
  cupRice.some((i) => i.includes("Day 1") && i.includes("Breakfast") && i.includes("Rice") && i.includes("1 cup"))
);

const katoriDal = quantityUnitIssues([
  day("Day 2", [meal("Lunch", [{ food: "Dal fry", quantity: "1 katori" }])]),
]);
check("\"1 katori\" is flagged", katoriDal.some((i) => i.includes("Dal fry")));

const plural = quantityUnitIssues([
  day("Day 3", [meal("Dinner", [{ food: "Salad", quantity: "2 bowls" }])]),
]);
check("the plural \"bowls\" is also flagged", plural.length > 0, plural.join(" | "));

for (const unit of ["plate", "glass", "handful"]) {
  const found = quantityUnitIssues([
    day("Day X", [meal("Snack", [{ food: "Item", quantity: `1 ${unit}` }])]),
  ]);
  check(`"1 ${unit}" is flagged`, found.length > 0);
}

// --- 2. Compliant units are NOT flagged -------------------------------------
const compliant = quantityUnitIssues([
  day("Day 4", [
    meal("Breakfast", [
      { food: "Rice", quantity: "150 g" },
      { food: "Filter coffee", quantity: "200 ml" },
      { food: "Roti", quantity: "2" },
      { food: "Almonds", quantity: "1 tbsp" },
      { food: "Chia seeds", quantity: "1 tsp" },
      { food: "Eggs", quantity: "2 whole" },
    ]),
  ]),
]);
check("grams/ml/plain-count/tbsp/tsp are all left alone", compliant.length === 0, compliant.join(" | "));

// --- 3. Multiple offenders in one meal are all named ------------------------
const multi = quantityUnitIssues([
  day("Day 5", [
    meal("Breakfast", [
      { food: "Rice", quantity: "1 cup" },
      { food: "Filter coffee", quantity: "1 cup" },
      { food: "Roti", quantity: "2" },
    ]),
  ]),
]);
check(
  "both offenders in the same meal are named in one message",
  multi.length === 1 && multi[0].includes("Rice") && multi[0].includes("Filter coffee"),
  multi.join(" | ")
);

// --- 4. "cupcake" or similar must not false-positive on substring match -----
const cupcake = quantityUnitIssues([
  day("Day 6", [meal("Snack", [{ food: "Cupcake", quantity: "1" }])]),
]);
check(
  "a food named \"Cupcake\" with a plain-count quantity is not flagged",
  cupcake.length === 0,
  cupcake.join(" | ")
);

console.log(failed === 0 ? `\nall quantity-unit checks pass` : `\n${failed} FAILURES`);
process.exitCode = failed === 0 ? 0 : 1;

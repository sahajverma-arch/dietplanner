// Drinks — tapped, and counted.
//
// These used to be free text that nothing read, so a client on three sweet
// milk teas a day had roughly 200 kcal sitting outside their measured intake.
// The numbers below are the whole point: if a drink stops being counted, the
// intake silently drops and the week-1 protein target drops with it, and
// nothing on screen looks wrong.
//
// Run: npx -y tsx scripts/tests/beverages.test.mts
import {
  beverageIntake,
  beverageQuestionId,
  encodeStaplePick,
  decodeStaplePick,
  estimateProteinIntake,
  BEVERAGE_LABELS,
} from "../../src/lib/protein-intake";
import type { Answers } from "../../src/lib/counselling/questions";
import { encodeVariants } from "../../src/lib/counselling/meal-variants";

let failed = 0;
const check = (name: string, pass: boolean, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${name.padEnd(56)}${detail}`);
};
const kcal = (a: Answers) => beverageIntake(a).reduce((t, b) => t + b.kcalPerDay, 0);
const labels = (a: Answers) => beverageIntake(a).map((b) => b.label);

// --- tapped picks ------------------------------------------------------------
const tapped: Answers = {
  [beverageQuestionId("breakfast")]: [encodeStaplePick("Tea with sugar", 2)],
  [beverageQuestionId("evening")]: [encodeStaplePick("Tea with sugar", 1)],
};
check("a tapped drink is counted", kcal(tapped) === 210, `${kcal(tapped)} kcal`);
check("...across every occasion it was tapped", beverageIntake(tapped)[0].units === 3);
check(
  "a drink survives the encode/decode round trip",
  decodeStaplePick(encodeStaplePick("Buttermilk or chaas", 2))?.label === "Buttermilk or chaas"
);
check(
  "every offered drink can be read back",
  BEVERAGE_LABELS.every((l) => decodeStaplePick(encodeStaplePick(l, 1))?.label === l)
);
check("junk is still rejected", decodeStaplePick("note x 3") === null);

// --- counsellings recorded before the picker ---------------------------------
check(
  "a typed drink is still counted",
  kcal({ q28_breakfast_beverage: "tea with 1 tsp sugar" }) === 70,
  `${kcal({ q28_breakfast_beverage: "tea with 1 tsp sugar" })} kcal`
);
check(
  "...including when it was typed into the food line",
  labels({ q28_breakfast_food: "Poha 1 plate + tea with 1 tsp sugar" }).join() === "Tea with sugar"
);
check(
  "a tap overrides the text for that meal, never both",
  kcal({
    [beverageQuestionId("breakfast")]: [encodeStaplePick("Black coffee", 1)],
    q28_breakfast_beverage: "2 cups tea",
  }) === 5
);

// --- the specific drink matters ----------------------------------------------
for (const [text, expected] of [
  ["green tea", "Green or black tea"],
  ["black coffee", "Black coffee"],
  ["coffee", "Coffee with sugar"],
  ["1 glass milk", "Milk"],
  ["buttermilk", "Buttermilk or chaas"],
  ["diet coke", "Diet soft drink"],
  ["coconut water", "Coconut water"],
] as const)
  check(`"${text}" reads as ${expected}`, labels({ q28_evening_beverage: text })[0] === expected, labels({ q28_evening_beverage: text })[0]);

check(
  "sugar is the difference between two teas",
  beverageIntake({ q28_breakfast_beverage: "tea" })[0].kcalPerDay >
    beverageIntake({ q28_breakfast_beverage: "tea no sugar" })[0].kcalPerDay
);
check("an unrecognised drink is not invented", labels({ q28_evening_beverage: "kombucha" }).length === 0);
check("nothing recorded counts as nothing", kcal({}) === 0);
check(
  "a protein shake in a meal is not also counted as a drink",
  labels({ q28_breakfast_food: "1 scoop protein powder" }).length === 0
);

// --- and it reaches the measured intake --------------------------------------
const meals = encodeVariants([
  {
    id: "v1", label: "Poha", items: [{ food: "Poha", qty: "1 bowl" }], daysPerWeek: 7,
    measured: { calories: 177, protein_g: 5, carbs_g: 21, fat_g: 8 },
  },
]);
const withoutDrinks: Answers = { q112_breakfast_variants: meals };
const withDrinks: Answers = {
  ...withoutDrinks,
  [beverageQuestionId("breakfast")]: [encodeStaplePick("Tea with sugar", 2)],
};
const before = estimateProteinIntake(withoutDrinks);
const after = estimateProteinIntake(withDrinks);
check(
  "drinks are added on top of the measured meals",
  after.kcalPerDay === before.kcalPerDay + 140,
  `${before.kcalPerDay} -> ${after.kcalPerDay} kcal`
);
check(
  "...protein too",
  Math.round(after.gramsPerDay) === Math.round(before.gramsPerDay + 3.6),
  `${before.gramsPerDay} -> ${after.gramsPerDay} g`
);
check("...and they are reported separately", after.beverages.length === 1 && after.beverageKcalPerDay === 140);
check("a day with no drinks reports none", before.beverages.length === 0 && before.beverageKcalPerDay === 0);
check(
  "the energy split still totals 100",
  after.energySplit.protein + after.energySplit.carbs + after.energySplit.fat === 100,
  JSON.stringify(after.energySplit)
);

console.log(failed === 0 ? `\nall beverage checks pass` : `\n${failed} FAILURES`);
process.exitCode = failed === 0 ? 0 : 1;

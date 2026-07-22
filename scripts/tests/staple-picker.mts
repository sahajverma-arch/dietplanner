// Checks the tap-to-count staple picker against the free-text food day it
// replaces: the same meal recorded either way must produce the same numbers,
// recording it BOTH ways must not count it twice, and the panel's warning
// must distinguish "not filled in" from "filled in but unreadable".
//
// Run: npx tsx scripts/tests/staple-picker.mts
import {
  encodeStaplePick,
  estimateProteinIntake,
  stapleQuestionId,
} from "../../src/lib/protein-intake";
import { mealDetailComplete } from "../../src/lib/counselling/assessment";
import type { Answers } from "../../src/lib/counselling/questions";

let failures = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${msg}`);
  if (!cond) failures++;
};

const BASE: Answers = {
  q9_weight: "70",
  q33: "Vegetarian",
  q50: ["Curd"],
  q50p_curd_freq: "Daily",
  q28: ["Lunch"],
};

const typed: Answers = { ...BASE, q28_lunch_food: "2 rotis + rice + sabzi" };
const tapped: Answers = {
  ...BASE,
  [stapleQuestionId("lunch")]: [
    encodeStaplePick("Roti", 2),
    encodeStaplePick("Rice", 1),
    encodeStaplePick("Sabzi", 1),
  ],
};
const both: Answers = { ...typed, ...tapped };

const t = estimateProteinIntake(typed);
const p = estimateProteinIntake(tapped);
const b = estimateProteinIntake(both);

console.log(`\ntyped  : P${t.gramsPerDay} C${t.carbsPerDay} F${t.fatPerDay} ${t.kcalPerDay} kcal`);
console.log(`tapped : P${p.gramsPerDay} C${p.carbsPerDay} F${p.fatPerDay} ${p.kcalPerDay} kcal`);
console.log(`both   : P${b.gramsPerDay} C${b.carbsPerDay} F${b.fatPerDay} ${b.kcalPerDay} kcal\n`);

check(
  t.carbsPerDay === p.carbsPerDay && t.gramsPerDay === p.gramsPerDay && t.fatPerDay === p.fatPerDay,
  "tapping the same meal gives the same macros as typing it"
);
check(
  b.carbsPerDay === p.carbsPerDay,
  "recording a meal both ways counts it once, not twice"
);

// The three food-day states the panel branches on.
check(estimateProteinIntake(typed).foodDay === "counted", 'typed + parseable -> "counted"');
check(estimateProteinIntake(tapped).foodDay === "counted", 'tapped -> "counted"');
check(
  estimateProteinIntake({ ...BASE, q28_lunch_food: "lunch: home food" }).foodDay === "unmatched",
  'typed but unparseable -> "unmatched" (the dangerous case)'
);
check(estimateProteinIntake(BASE).foodDay === "none", 'nothing recorded -> "none"');

// A tap-only consultation must not be graded as an incomplete food day.
check(mealDetailComplete(tapped), "tap-only food day counts as complete");
check(mealDetailComplete(typed), "typed food day still counts as complete");
check(!mealDetailComplete(BASE), "empty food day is still incomplete");

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);

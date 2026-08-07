// Regression test for plan variety — the complaint the whole draft review was
// built for, and one that has now been got wrong twice.
//
// First a prompt instruction was added and a run still returned Day 1 and Day 2
// identical. Then a whole-day check was added, and a run passed it with seven
// distinct days whose breakfasts repeated and whose dinner was the same four
// foods all week. Both failures are pinned here.
//
// Run: npx -y tsx scripts/tests/variety.test.mts
import { varietyIssues } from "../../src/lib/nim";
import type { DietPlan } from "../../src/lib/nim";

let failed = 0;
const check = (name: string, pass: boolean, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${name.padEnd(60)}${detail}`);
};

const meal = (name: string, foods: string[]) => ({
  name, time: "", items: foods.map((f) => ({ food: f, quantity: "1" })), notes: "",
  calories: 400, protein_g: 20, carbs_g: 40, fat_g: 10, alternates: [],
});
const day = (name: string, breakfast: string[], dinner: string[]): DietPlan["days"][number] => ({
  day: name, total_calories: 2000,
  meals: [meal("Breakfast", breakfast), meal("Dinner", dinner)],
});

const EGGS = ["Scrambled eggs", "Whole wheat bread", "Curd"];
const BHINDI = ["Bhindi sabzi", "Whole wheat bread", "Curd"];
const POHA = ["Poha", "Curd"];
const DAL_FRY = ["Roti", "Dal fry", "Mixed vegetables", "Curd"];
const DAL_MAKHANI = ["Roti", "Dal makhani", "Mixed vegetables", "Curd"];
const PANEER = ["Roti", "Curd", "Paneer sabzi"];
const RAJMA = ["Roti", "Curd", "Rajma"];

// --- 1. A whole day repeated ------------------------------------------------
check(
  "an identical day is flagged",
  varietyIssues([day("Day 2", EGGS, DAL_FRY)], [day("Day 1", EGGS, DAL_FRY)]).some((i) =>
    i.includes("repeats Day 1")
  )
);
check(
  "the same day reordered is still the same day",
  varietyIssues(
    [day("Day 2", [...EGGS].reverse(), [...DAL_FRY].reverse())],
    [day("Day 1", EGGS, DAL_FRY)]
  ).length > 0
);

// --- 2. The same meal across different days ---------------------------------
// Twice is ordinary home eating; the third time is the repetition.
const twice = varietyIssues([day("Day 3", EGGS, PANEER)], [day("Day 1", EGGS, DAL_FRY)]);
check("the same breakfast twice is allowed", twice.length === 0, twice.join(" | "));

const thrice = varietyIssues(
  [day("Day 5", EGGS, RAJMA)],
  [day("Day 1", EGGS, DAL_FRY), day("Day 3", EGGS, PANEER)]
);
check(
  "a third identical breakfast is flagged",
  thrice.some((i) => i.includes("Breakfast")),
  thrice.join(" | ")
);

// --- 3. The same meal under a different dish name ---------------------------
// This is what slipped through: dal fry and dal makhani are one dinner.
const renamed = varietyIssues(
  [day("Day 5", POHA, DAL_MAKHANI)],
  [day("Day 1", EGGS, DAL_FRY), day("Day 3", BHINDI, DAL_FRY)]
);
check(
  "a renamed dish does not disguise the same dinner",
  renamed.some((i) => i.includes("Dinner")),
  renamed.join(" | ")
);

// --- 4. Genuinely different meals sharing staples must NOT be flagged -------
// Rule 20 keeps 50-70% of the client's familiar pattern; roti and curd
// recurring is Indian home eating, not repetition.
const shared = varietyIssues(
  [day("Day 5", POHA, RAJMA)],
  [day("Day 1", EGGS, PANEER), day("Day 3", BHINDI, DAL_FRY)]
);
check("different mains sharing roti and curd are fine", shared.length === 0, shared.join(" | "));

// --- 5. Repetition inside one batch, with nothing planned yet ---------------
check(
  "two identical days in the same batch are caught",
  varietyIssues([day("Day 1", EGGS, DAL_FRY), day("Day 2", EGGS, DAL_FRY)], []).length > 0
);
check(
  "a clean batch passes",
  varietyIssues([day("Day 1", EGGS, PANEER), day("Day 2", POHA, RAJMA)], []).length === 0
);

// --- 6. The real failing week -----------------------------------------------
// Seven "distinct" days that passed the old whole-day check.
const realWeek = [
  day("Day 1", ["Egg and vegetable omelette", "Whole wheat bread"], DAL_MAKHANI),
  day("Day 2", ["Avocado toast", "Scrambled eggs"], DAL_FRY),
  day("Day 3", EGGS, DAL_MAKHANI),
  day("Day 4", BHINDI, DAL_FRY),
  day("Day 5", EGGS, DAL_FRY),
  day("Day 6", BHINDI, DAL_FRY),
  day("Day 7", ["Tofu scramble", "Whole wheat bread", "Curd"], DAL_MAKHANI),
];
const found = varietyIssues(realWeek, []);
check(
  "the week that passed the old check is now caught",
  found.length > 0,
  `${found.length} issue(s)`
);
console.log(`\n   ${found.slice(0, 3).join("\n   ")}`);

// --- 7. The same dish across DIFFERENT occasions ----------------------------
// A live quick-intake plan passed the per-occasion check entirely — Breakfast
// never repeated Breakfast, Dinner never repeated Dinner — while "Roti,
// Paneer, Guava, Olive oil" served as the literal breakfast on three days AND
// the literal dinner on three other days. Half the occurrences were always on
// the wrong side of the occasion split to ever reach MAX_MEAL_REPEATS.
const PANEER_MEAL = ["Roti", "Paneer, low-fat", "Guava", "Olive oil"];
const RICE_MEAL = ["Rice", "Paneer, low-fat", "Papaya", "Olive oil"];
const swapped = [
  day("Day 1", PANEER_MEAL, RICE_MEAL),
  day("Day 2", RICE_MEAL, PANEER_MEAL),
  day("Day 3", PANEER_MEAL, RICE_MEAL),
  day("Day 4", RICE_MEAL, PANEER_MEAL),
];
const crossOccasion = varietyIssues(swapped, []);
check(
  "the same dish swapping between breakfast and dinner is caught, not just per-occasion repeats",
  crossOccasion.some((i) => i.includes("even across different meal occasions")),
  crossOccasion.join(" | ")
);

console.log(failed === 0 ? `\nall variety checks pass` : `\n${failed} FAILURES`);
process.exitCode = failed === 0 ? 0 : 1;

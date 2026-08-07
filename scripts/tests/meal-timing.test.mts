// Regression test for a real shipped bug: "Evening Snack" scheduled at
// 21:00, two hours after a 19:00 dinner — the per-occasion variety check and
// every other quality check passed this plan, because none of them compare
// a meal's NAME against its TIME. "Evening" means before dinner; a name
// that means one thing timed for another is confusing regardless of what
// else is on the plate.
//
// Run: npx -y tsx scripts/tests/meal-timing.test.mts
import { mealTimingIssues } from "../../src/lib/nim";
import type { DietPlan } from "../../src/lib/nim";

let failed = 0;
const check = (name: string, pass: boolean, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${name.padEnd(65)}${detail}`);
};

const meal = (name: string, time: string) => ({
  name, time, items: [{ food: "Something", quantity: "100 g" }], notes: "",
  calories: 200, protein_g: 10, carbs_g: 20, fat_g: 5, alternates: [],
});
const day = (name: string, meals: ReturnType<typeof meal>[]): DietPlan["days"][number] => ({
  day: name, total_calories: 2000, meals,
});

// --- 1. The real shipped bug -------------------------------------------------
const shipped = mealTimingIssues([
  day("Day 1", [
    meal("Breakfast", "08:00"),
    meal("Mid-morning Snack", "10:30"),
    meal("Lunch", "12:30"),
    meal("Mid-afternoon Snack", "15:00"),
    meal("Dinner", "19:00"),
    meal("Evening Snack", "21:00"),
  ]),
]);
check(
  "Evening Snack timed after Dinner is flagged",
  shipped.some((i) => i.includes("Evening Snack") && i.includes("AFTER dinner")),
  shipped.join(" | ")
);

// --- 2. Evening before dinner is fine ---------------------------------------
const correct = mealTimingIssues([
  day("Day 1", [
    meal("Breakfast", "08:00"),
    meal("Lunch", "13:00"),
    meal("Evening Snack", "17:00"),
    meal("Dinner", "20:00"),
  ]),
]);
check("Evening Snack timed before Dinner is not flagged", correct.length === 0, correct.join(" | "));

// --- 3. A genuinely late snack is fine IF it's not named "Evening" ----------
const nightSnack = mealTimingIssues([
  day("Day 1", [
    meal("Dinner", "19:00"),
    meal("Night Snack", "21:00"),
  ]),
]);
check("a Night Snack after dinner is not flagged", nightSnack.length === 0, nightSnack.join(" | "));

const postDinner = mealTimingIssues([
  day("Day 1", [
    meal("Dinner", "19:00"),
    meal("Post-Dinner Snack", "21:00"),
  ]),
]);
check("a Post-Dinner Snack after dinner is not flagged", postDinner.length === 0, postDinner.join(" | "));

// --- 4. A day with no dinner at all is left alone ---------------------------
const noDinner = mealTimingIssues([
  day("Day 1", [meal("Breakfast", "08:00"), meal("Evening Snack", "21:00")]),
]);
check("a day with no dinner has nothing to compare against, so nothing is flagged", noDinner.length === 0, noDinner.join(" | "));

// --- 5. Missing/unparseable times don't crash -------------------------------
let crashed = false;
try {
  mealTimingIssues([day("Day 1", [meal("Dinner", ""), meal("Evening Snack", "not a time")])]);
} catch {
  crashed = true;
}
check("missing or malformed times are skipped, not thrown on", !crashed);

console.log(failed === 0 ? "\nall meal-timing checks pass" : `\n${failed} FAILURES`);
process.exitCode = failed === 0 ? 0 : 1;

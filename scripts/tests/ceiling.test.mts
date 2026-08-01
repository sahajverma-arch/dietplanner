// The calorie hard ceiling, and the correction instructions that must not
// contradict each other.
//
// Both come from a real draft: a 1,669 kcal / 55 g plan that shipped days at
// 1811-2816 kcal and 89 g protein, because a day over on BOTH was told to cut
// its protein portions and to leave protein foods alone in the same message.
//
// Run: npx -y tsx scripts/tests/ceiling.test.mts
import {
  daysOverCeiling,
  reconcileNeed,
  CALORIE_HARD_CEILING,
} from "../../src/lib/nutrition-reconcile";
import { perMainMeal, perSnack, proteinCeiling } from "../../src/lib/day-targets";
import type { DietPlan } from "../../src/lib/nim";

let failed = 0;
const check = (name: string, pass: boolean, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${name.padEnd(60)}${detail}`);
};

/** One meal carrying the whole day, so the totals are exact. */
const day = (name: string, kcal: number, protein: number): DietPlan["days"][number] =>
  ({
    day: name,
    total_calories: kcal,
    meals: [
      {
        name: "Lunch",
        time: "13:00",
        items: [{ food: "Dal", quantity: "1 katori" }],
        calories: kcal,
        protein_g: protein,
        carbs_g: 0,
        fat_g: 0,
        notes: "",
      },
    ],
  }) as unknown as DietPlan["days"][number];

const plan = (days: DietPlan["days"]): DietPlan =>
  ({
    summary: "",
    daily_calories: 1669,
    macros: { protein_g: 55, carbs_g: 245, fat_g: 52 },
    guidelines: [],
    hydration: "",
    days,
    foods_to_avoid: [],
  }) as unknown as DietPlan;

// The real draft's day totals.
const REAL = plan([
  day("Day 1", 1811, 89),
  day("Day 2", 1689, 78),
  day("Day 3", 2313, 90),
  day("Day 4", 2456, 92),
  day("Day 5", 2816, 95),
  day("Day 6", 2513, 91),
  day("Day 7", 2068, 88),
]);

const ceiling = Math.round(1669 * CALORIE_HARD_CEILING);
console.log(`\nceiling is ${CALORIE_HARD_CEILING}x the 1669 kcal target = ${ceiling} kcal\n`);

const over = daysOverCeiling(REAL);
check(
  "the real draft is caught — 5 of 7 days breach the ceiling",
  over.length === 5,
  over.map((d) => `${d.day} ${d.kcal}`).join(", ")
);
check("Day 5 at 2816 kcal is named", over.some((d) => d.kcal === 2816));
check(
  "a day just under the ceiling is not caught",
  daysOverCeiling(plan([day("Day 1", ceiling - 1, 55)])).length === 0
);
check(
  "a day just over it is",
  daysOverCeiling(plan([day("Day 1", ceiling + 20, 55)])).length === 1
);
check("a plan with no calorie target cannot breach", daysOverCeiling({
  ...plan([day("Day 1", 9000, 55)]),
  daily_calories: 0,
} as DietPlan).length === 0);
check("an on-target plan is clean", daysOverCeiling(plan([day("Day 1", 1669, 55)])).length === 0);

// --- the contradiction ------------------------------------------------------
const bothOver = reconcileNeed(plan([day("Day 1", 2313, 90)])).instructions;
check(
  "a day over on BOTH is not told to protect protein foods",
  !bothOver.includes("Do NOT cut protein foods"),
  bothOver.includes("Do NOT cut protein foods") ? "still contradicts" : "contradiction gone"
);
check(
  "...it is told those portions are the excess",
  bothOver.includes("over on protein as well")
);
check(
  "...and still told to reduce the protein portions",
  bothOver.includes("OVER the 55 g target")
);

// Over on calories ALONE must keep the protection — protein is not the problem.
const calorieOnly = reconcileNeed(plan([day("Day 1", 2313, 55)])).instructions;
check(
  "a day over on calories only still protects protein foods",
  calorieOnly.includes("Do NOT cut protein foods"),
  calorieOnly.includes("Do NOT cut protein foods") ? "protected" : "protection lost"
);
check(
  "...and is not told it is over on protein",
  !calorieOnly.includes("over on protein as well")
);

// Short on protein must be unaffected by any of this.
const short = reconcileNeed(plan([day("Day 1", 1669, 20)])).instructions;
check("a protein-short day is still asked to strengthen its weakest meals", short.includes("short — strengthen"));

// --- enforcing the ceiling -------------------------------------------------
// The real plan: calories landed in band but protein ran to 76 g against 55 g,
// and every correction that cut protein blew the calories and was rejected.
const proteinOnly = reconcileNeed(plan([day("Day 1", 1750, 86)])).instructions;
check(
  "an over-protein day is told to SWAP, not cut",
  proteinOnly.includes("SWAP, do not simply cut"),
);
check(
  "...and told what to put back, so the calories hold",
  proteinOnly.includes("put back roughly") && proteinOnly.includes("so the day's calories DO NOT drop"),
  proteinOnly.slice(proteinOnly.indexOf("put back"), proteinOnly.indexOf("put back") + 46)
);
check(
  "...with the replacement sized to the protein removed",
  // 86 g over a 55 g target is 31 g -> 124 kcal to put back.
  proteinOnly.includes(`${(86 - 55) * 4} kcal of vegetables`),
);
check(
  "...and told to drop the extra source, not the dal",
  proteinOnly.includes("drop the extra source, keep the dal"),
);
check(
  "the ceiling is stated as a number the model can check against",
  proteinOnly.includes(`ceiling ${Math.round(55 * 1.25)} g`),
);
check(
  "protein is framed as a ceiling as well as a floor",
  proteinOnly.includes("Protein is a CEILING as well as a floor"),
);
check(
  "and the per-meal split is given, because a daily figure is not composable",
  proteinOnly.includes(`${perMainMeal(55)} g of protein per main meal`) &&
    proteinOnly.includes(`${perSnack(55)} g per snack`),
  `${perMainMeal(55)} g main / ${perSnack(55)} g snack`
);
check(
  "the split sums to the target",
  perMainMeal(55) * 3 + perSnack(55) * 2 === 55,
  `${perMainMeal(55)}x3 + ${perSnack(55)}x2 = ${perMainMeal(55) * 3 + perSnack(55) * 2}`
);
check(
  "the stated ceiling is tighter than the one that actually fails a day",
  proteinCeiling(55) < 55 * 1.25,
  `aim ${proteinCeiling(55)} g, fail at ${Math.round(55 * 1.25)} g`
);

console.log(failed === 0 ? `\nall ceiling checks pass` : `\n${failed} FAILURES`);
process.exitCode = failed === 0 ? 0 : 1;

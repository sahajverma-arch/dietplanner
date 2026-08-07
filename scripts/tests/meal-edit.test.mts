// Regression test for per-meal editing of a draft plan (the pencil menu).
//
// Two things must hold for a swapped-in meal to be trustworthy:
//
//  1. groundMeals() prices a meal on its own EXACTLY as groundPlan() prices the
//     same meal inside a week. Both now share one grounder; if they ever drift,
//     an alternative would show the dietitian one calorie figure in the panel
//     and store a different one in the plan.
//  2. mealRuleIssues() is the safety gate the /api/plan-meal route relies on —
//     the option comes back from the BROWSER, so allergens, dislikes, diet type
//     and the client's weekday (q38) rules are re-checked before it is stored.
//
// Run: npx -y tsx scripts/tests/meal-edit.test.mts
import type { DietPlan } from "../../src/lib/nim";
import { mealRuleIssues, mealRuleReport } from "../../src/lib/nim";
import { groundMeals, groundPlan, normName } from "../../src/lib/nutrition";
import type { IntakeForm } from "../../src/lib/types";

// --- A tiny stand-in for the foods table, so the test needs no database. -----
const FOODS = [
  { name: "Roti", kcal: 297, protein_g: 11, carbs_g: 58, fat_g: 3.7, serving_g: 40, serving_unit: "roti" },
  { name: "Paneer bhurji", kcal: 210, protein_g: 14, carbs_g: 6, fat_g: 15, serving_g: 150, serving_unit: "katori" },
  { name: "Rajma curry", kcal: 118, protein_g: 6, carbs_g: 17, fat_g: 3, serving_g: 150, serving_unit: "katori" },
  { name: "Brown rice", kcal: 123, protein_g: 2.7, carbs_g: 26, fat_g: 1, serving_g: 150, serving_unit: "cup" },
  { name: "Curd", kcal: 60, protein_g: 3.1, carbs_g: 4.7, fat_g: 3.3, serving_g: 150, serving_unit: "katori" },
  { name: "Boiled egg", kcal: 155, protein_g: 13, carbs_g: 1.1, fat_g: 11, serving_g: 50, serving_unit: "egg" },
  { name: "Peanut chikki", kcal: 480, protein_g: 15, carbs_g: 55, fat_g: 22, serving_g: 30, serving_unit: "piece" },
  { name: "Chicken curry", kcal: 165, protein_g: 20, carbs_g: 4, fat_g: 8, serving_g: 150, serving_unit: "katori" },
];

const supabase = {
  rpc: async (_fn: string, { queries }: { queries: string[] }) => ({
    data: queries.flatMap((query) => {
      const food = FOODS.find((f) => normName(f.name) === query);
      return food
        ? [{ query, food_id: 1, source: "EXCHANGE", fiber_g: null, similarity: 1, ...food }]
        : [];
    }),
    error: null,
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const item = (food: string, quantity: string) => ({ food, quantity });
const meal = (
  name: string,
  time: string,
  items: { food: string; quantity: string }[],
  calories = 400,
  protein_g = 20
) => ({
  name,
  time,
  items,
  notes: "",
  calories,
  protein_g,
  carbs_g: 45,
  fat_g: 12,
  alternates: [],
});

const LUNCH = meal("Lunch", "13:30", [
  item("Rajma curry", "1 katori"),
  item("Brown rice", "1 cup"),
  item("Curd", "1 katori"),
]);
const ALTERNATIVE = meal("Lunch", "13:30", [
  item("Paneer bhurji", "1 katori"),
  item("Roti", "2"),
]);

const day = (name: string, meals: (typeof LUNCH)[]) => ({
  day: name,
  total_calories: 1600,
  meals,
});

const plan: DietPlan = {
  summary: "test",
  daily_calories: 1600,
  macros: { protein_g: 90, carbs_g: 160, fat_g: 50 },
  guidelines: [],
  hydration: "",
  days: Array.from({ length: 7 }, (_, i) =>
    day(`Day ${i + 1}`, [meal("Breakfast", "08:00", [item("Boiled egg", "2")], 160, 13), LUNCH])
  ),
  foods_to_avoid: [],
};

const intake = (over: Partial<IntakeForm> = {}): IntakeForm =>
  ({
    fullName: "Test",
    dietType: "non-vegetarian",
    allergies: "",
    intolerances: "",
    dislikes: "",
    conditions: [],
    ...over,
  }) as IntakeForm;

let failed = 0;
const check = (name: string, pass: boolean, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${name.padEnd(62)}${detail}`);
};

// --- 1. One meal priced alone == the same meal priced inside a week ----------
const [alone] = (await groundMeals(supabase, [LUNCH])).meals;
const inPlan = (await groundPlan(supabase, plan)).plan.days[0].meals[1];

check(
  "groundMeals matches groundPlan on calories",
  alone.calories === inPlan.calories,
  `alone=${alone.calories} inPlan=${inPlan.calories}`
);
check(
  "groundMeals matches groundPlan on macros",
  alone.protein_g === inPlan.protein_g &&
    alone.carbs_g === inPlan.carbs_g &&
    alone.fat_g === inPlan.fat_g,
  `alone=P${alone.protein_g}/C${alone.carbs_g}/F${alone.fat_g} inPlan=P${inPlan.protein_g}/C${inPlan.carbs_g}/F${inPlan.fat_g}`
);
check(
  "the meal is really grounded, not left on the model estimate",
  alone.calories !== LUNCH.calories && alone.calories > 0,
  `db=${alone.calories} model=${LUNCH.calories}`
);

// A day's calories must be the sum of its meals after any swap — the route
// recomputes total_calories, so grounding has to report per-meal numbers.
const groundedDay = (await groundPlan(supabase, plan)).plan.days[0];
check(
  "day total equals the sum of its grounded meals",
  groundedDay.total_calories === Math.round(groundedDay.meals.reduce((s, m) => s + m.calories, 0))
);

// An alternative made only of matched foods must price out of the database too.
const [groundedAlt] = (await groundMeals(supabase, [ALTERNATIVE])).meals;
check(
  "an alternative prices out of the database",
  groundedAlt.calories > 0 && groundedAlt.calories !== ALTERNATIVE.calories,
  `${groundedAlt.calories} kcal, P${groundedAlt.protein_g}`
);

// An unmatched food leaves the meal on its own estimate rather than inventing one.
const ragi = await groundMeals(supabase, [
  meal("Lunch", "13:30", [item("Ragi mudde", "2")], 350, 8),
]);
const [unmatched] = ragi.meals;
check(
  "an unmatchable meal keeps its model estimate",
  unmatched.calories === 350 && unmatched.protein_g === 8
);
check("...and names the food it could not price", ragi.unpriced[0].includes("Ragi mudde"));

// A meal the dietitian TYPED arrives with no estimate (calories 0), so an
// item that cannot be priced silently drags the totals down. The route shows
// these names to the dietitian; if this ever returns [] the warning goes
// quiet and they are told 27 kcal is the truth.
const typed = await groundMeals(supabase, [
  meal("Lunch", "13:30", [item("Roti", "2"), item("Ragi mudde", "1 serving")], 0, 0),
]);
check(
  "a typed meal reports the item excluded from its totals",
  typed.unpriced[0].includes("Ragi mudde") && !typed.unpriced[0].includes("Roti"),
  `unpriced=[${typed.unpriced[0].join(", ")}] kcal=${typed.meals[0].calories}`
);
check(
  "...while still pricing the items it could",
  typed.meals[0].calories > 0
);
// An item that MATCHES a food but still cannot be priced — here a quantity
// that prices past ITEM_KCAL_MAX — is just as invisible in the totals as an
// unmatched one. This is the hole a name-only check missed: the food is in the
// database, so "did it match?" says yes while it contributes nothing.
const overSized = await groundMeals(supabase, [
  meal("Snack", "17:00", [item("Curd", "1 katori"), item("Peanut chikki", "500 g")], 0, 0),
]);
check(
  "a matched-but-unpriceable item is reported, not silently dropped",
  overSized.unpriced[0].includes("Peanut chikki") &&
    !overSized.unpriced[0].includes("Curd"),
  `unpriced=[${overSized.unpriced[0].join(", ")}] kcal=${overSized.meals[0].calories}`
);

// --- 2. The safety gate on a swapped-in meal --------------------------------
const issues = (over: Partial<IntakeForm>, swapped: typeof LUNCH, startsOn?: string) =>
  mealRuleIssues({ intake: intake(over), plan, dayIndex: 0, meals: [swapped], startsOn });

const eggLunch = meal("Lunch", "13:30", [item("Boiled egg", "2"), item("Roti", "2")]);
const peanutLunch = meal("Lunch", "13:30", [item("Peanut chikki", "1 piece")]);
const chickenLunch = meal("Lunch", "13:30", [item("Chicken curry", "1 katori")]);

check("clean swap passes", issues({}, ALTERNATIVE).length === 0);
check("allergen is caught", issues({ allergies: "peanut" }, peanutLunch).length > 0);
check("intolerance is caught", issues({ intolerances: "paneer" }, ALTERNATIVE).length > 0);
check("disliked food is caught", issues({ dislikes: "paneer" }, ALTERNATIVE).length > 0);
check(
  "egg is caught for a vegetarian",
  issues({ dietType: "vegetarian" }, eggLunch).length > 0
);
check(
  "chicken is caught for an eggetarian",
  issues({ dietType: "eggetarian" }, chickenLunch).length > 0
);
check(
  "curd is caught for a vegan",
  issues({ dietType: "vegan" }, LUNCH).length > 0
);

// q38: no non-veg on Tuesdays. Day 1 = 2026-07-28, a Tuesday.
const tuesdayRules = {
  q38a: ["Tuesday"],
  q38b: ["Non-vegetarian food"],
  q38c: "",
} as unknown as IntakeForm["conditions"];
const withDayRules = { answers: tuesdayRules } as unknown as Partial<IntakeForm>;

check(
  "weekday rule blocks chicken on the restricted day",
  issues(withDayRules, chickenLunch, "2026-07-28").length > 0
);
check(
  "weekday rule allows chicken on an unrestricted day",
  issues(withDayRules, chickenLunch, "2026-07-29").length === 0
);
check(
  "a meal on an unknown day index is rejected",
  mealRuleIssues({ intake: intake(), plan, dayIndex: 9, meals: [LUNCH] }).length > 0
);

// --- 3. Who may overrule what, when the dietitian types the meal themselves --
// An allergen must NEVER be overridable; a dislike or a weekday observance is
// the supervising dietitian's call. Getting this split wrong is the difference
// between respecting professional judgement and serving someone their allergen.
const report = (over: Partial<IntakeForm>, swapped: typeof LUNCH, startsOn?: string) =>
  mealRuleReport({ intake: intake(over), plan, dayIndex: 0, meals: [swapped], startsOn });

const allergy = report({ allergies: "peanut" }, peanutLunch);
check(
  "allergen BLOCKS and is never a mere warning",
  allergy.blocking.length > 0 && allergy.warnings.length === 0
);

const veg = report({ dietType: "vegetarian" }, eggLunch);
check(
  "diet-pattern break blocks",
  veg.blocking.length > 0 && veg.warnings.length === 0
);

const dislike = report({ dislikes: "paneer" }, ALTERNATIVE);
check(
  "a dislike only warns, so the dietitian can overrule it",
  dislike.warnings.length > 0 && dislike.blocking.length === 0
);

const weekday = report(withDayRules, chickenLunch, "2026-07-28");
check(
  "a weekday observance only warns",
  weekday.warnings.length > 0 && weekday.blocking.length === 0
);

const both = report({ allergies: "peanut", dislikes: "peanut" }, peanutLunch);
check(
  "a food that is BOTH allergen and dislike still blocks",
  both.blocking.length > 0
);

check("a clean meal has neither", (() => {
  const r = report({}, ALTERNATIVE);
  return r.blocking.length === 0 && r.warnings.length === 0;
})());

// mealRuleIssues (used for AI options) must stay the union of both — the model
// gets no benefit of the doubt on preferences.
check(
  "mealRuleIssues still catches what only warns for a human",
  issues({ dislikes: "paneer" }, ALTERNATIVE).length > 0
);

console.log(failed === 0 ? `\nall meal-edit checks pass` : `\n${failed} FAILURES`);
process.exitCode = failed === 0 ? 0 : 1;

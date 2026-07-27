// Regression test for the measured-intake redesign.
//
// The whole point of variants is that a meal eaten on 3 of 7 days counts as
// three sevenths of itself. Get that weighting wrong and every client's
// measured intake — and therefore their week-1 protein target, and therefore
// their plan — is wrong by the same factor, silently.
//
// Run: npx -y tsx scripts/tests/meal-variants.test.mts
import {
  decodeVariants,
  encodeVariants,
  variantIntake,
  variantsQuestionId,
  INTAKE_OVERRIDE_ID,
  macrosOf,
  uncoveredDays,
  type MealVariant,
} from "../../src/lib/counselling/meal-variants";
import { estimateProteinIntake } from "../../src/lib/protein-intake";
import type { Answers } from "../../src/lib/counselling/questions";

let failed = 0;
const check = (name: string, pass: boolean, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${name.padEnd(58)}${detail}`);
};

const variant = (
  id: string,
  days: number,
  protein: number,
  calories = protein * 10,
  items = [{ food: "Bread", qty: "4 slices" }]
): MealVariant => ({
  id,
  label: id,
  items,
  daysPerWeek: days,
  measured: { calories, protein_g: protein, carbs_g: 20, fat_g: 10 },
});

const answersWith = (meal: string, variants: MealVariant[]): Answers => ({
  [variantsQuestionId(meal)]: encodeVariants(variants),
});

// --- 1. Frequency weighting — the number everything else depends on ---------
// Bread omelette (28 g) 3 days, poha (6 g) 1 day, chilla (12 g) 1 day.
// Expected: (28*3 + 6*1 + 12*1) / 7 = 102/7 = 14.57 -> 15
const breakfast = answersWith("breakfast", [
  variant("omelette", 3, 28),
  variant("poha", 1, 6),
  variant("chilla", 1, 12),
]);
const intake = variantIntake(breakfast);
check(
  "a 3-day variant counts as three sevenths",
  intake.perDay.protein_g === 15,
  `got ${intake.perDay.protein_g} g/day, expected 15`
);
check(
  "a meal eaten every day counts in full",
  variantIntake(answersWith("lunch", [variant("dal chawal", 7, 20)])).perDay.protein_g === 20
);
check(
  "an unrecorded meal contributes nothing",
  variantIntake({}).perDay.protein_g === 0 && !variantIntake({}).recorded
);

// --- 2. Days coverage — a gap silently deflates the average -----------------
check(
  "unaccounted days are reported",
  uncoveredDays(intake.meals[0]) === 2,
  `covered ${intake.meals[0].daysCovered}/7`
);
check(
  "a fully covered week reports no gap",
  uncoveredDays(variantIntake(answersWith("lunch", [variant("x", 7, 10)])).meals[0]) === 0
);

// --- 3. The dietitian's correction always wins ------------------------------
const corrected: MealVariant = { ...variant("omelette", 7, 28), override: {
  calories: 400, protein_g: 40, carbs_g: 30, fat_g: 12,
} };
check(
  "an override replaces the measured value",
  macrosOf(corrected).protein_g === 40
);
check(
  "the override flows into the daily total",
  variantIntake(answersWith("breakfast", [corrected])).perDay.protein_g === 40
);
const wholeDayOverride: Answers = {
  ...breakfast,
  [INTAKE_OVERRIDE_ID]: JSON.stringify({ calories: 2000, protein_g: 77, carbs_g: 250, fat_g: 60 }),
};
const overridden = variantIntake(wholeDayOverride);
check(
  "overriding the whole day wins over the per-meal sum",
  overridden.perDay.protein_g === 77 && overridden.overridden
);

// --- 4. Nothing may throw on a half-written or corrupt draft ----------------
check("garbage decodes to empty, never throws", decodeVariants("not json").length === 0);
check("a non-array decodes to empty", decodeVariants('{"a":1}').length === 0);
check(
  "items without a food name are dropped",
  decodeVariants(JSON.stringify([{ id: "a", items: [{ food: "" }, { food: "Egg" }], daysPerWeek: 2 }]))[0]
    .items.length === 1
);
check(
  "days are clamped to a real week",
  decodeVariants(JSON.stringify([{ id: "a", items: [{ food: "X" }], daysPerWeek: 99 }]))[0]
    .daysPerWeek === 7
);
check(
  "a malformed whole-day override is ignored, not fatal",
  variantIntake({ ...breakfast, [INTAKE_OVERRIDE_ID]: "{{{" }).perDay.protein_g === 15
);

// --- 5. The estimate used by the plan reads the variants --------------------
const estimate = estimateProteinIntake({ ...breakfast, q9_weight: "70" });
check(
  "estimateProteinIntake prefers variants",
  estimate.source === "variants" && estimate.gramsPerDay === 15,
  `source=${estimate.source} grams=${estimate.gramsPerDay}`
);
check(
  "per-kg is derived from the recorded weight",
  estimate.gramsPerKg === 0.21,
  `got ${estimate.gramsPerKg}`
);
check(
  "counsellings taken before variants still measure the old way",
  estimateProteinIntake({ q50: ["Eggs"], q50p_eggs_freq: "Daily" }).source === "legacy"
);

console.log(failed === 0 ? `\nall meal-variant checks pass` : `\n${failed} FAILURES`);
process.exitCode = failed === 0 ? 0 : 1;

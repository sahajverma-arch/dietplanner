// roadmapAtGoal() — the diet-engine-worked-examples-v1.2 PDF's Category 4
// (Aadi) fix: a client already counselled as maintenance must not be
// projected onto a lower BMI-21 "goal" weight. A reverse diet targets
// maintenance at the CURRENT weight; the old behaviour showed a second,
// lower-weight prescription that the plan was never trying to reach.
//
// Run: npx -y tsx scripts/tests/roadmap-input.test.mts
import { roadmapFor, roadmapAtGoal } from "../../src/lib/counselling/roadmap-input";
import { INTAKE_OVERRIDE_ID } from "../../src/lib/counselling/meal-variants";
import { ROADMAP_CATEGORY_ID, type Answers } from "../../src/lib/counselling/questions";

let failed = 0;
const check = (name: string, pass: boolean, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${name.padEnd(70)}${detail}`);
};

const base: Answers = {
  q9_weight: "66",
  q9_height: "172",
  q9_age: "27",
  gender: "Male",
  q54c: "Mostly seated",
  q44a: "4",
  q44e: "Moderate",
  q44b: "45–60 minutes",
  [INTAKE_OVERRIDE_ID]: JSON.stringify({ calories: 1958, protein_g: 83, carbs_g: 227, fat_g: 77 }),
};

// A client already counselled as Category 4 (maintenance).
const aadi: Answers = { ...base, [ROADMAP_CATEGORY_ID]: "Maintenance — at or near goal, holding it" };
const roadmap = roadmapFor(aadi);
const atGoal = roadmapAtGoal(aadi, roadmap);

check("a roadmap builds for the maintenance client", roadmap !== null);
check(
  "own prescription matches the PDF's worked figures (2264 kcal, P99 F63 C325)",
  roadmap?.targetKcal === 2264 && roadmap?.macros.protein_g === 99 && roadmap?.macros.fat_g === 63 && roadmap?.macros.carbs_g === 325,
  `${roadmap?.targetKcal} kcal, P${roadmap?.macros.protein_g} F${roadmap?.macros.fat_g} C${roadmap?.macros.carbs_g}`
);
check(
  "roadmapAtGoal() returns the client's OWN roadmap, not a lower-weight projection",
  atGoal === roadmap
);
check(
  "...so the weight shown is the client's current weight, not a BMI-21 target",
  atGoal?.weightKg === 66,
  `${atGoal?.weightKg} kg (targetWeightKg would be ${roadmap?.targetWeightKg} kg)`
);

// A non-maintenance client (Category 1) still gets the real lower-weight
// projection — this fix must not suppress it for anyone else.
const priya: Answers = {
  q9_weight: "74",
  q9_height: "160",
  q9_age: "32",
  gender: "Female",
  q54c: "Lightly active",
  q44a: "3",
  q44e: "Light",
  q44b: "30–45 minutes",
  [ROADMAP_CATEGORY_ID]: "First-timer — never dieted with structure before",
  [INTAKE_OVERRIDE_ID]: JSON.stringify({ calories: 1625, protein_g: 50, carbs_g: 218, fat_g: 60 }),
};
const priyaRoadmap = roadmapFor(priya);
const priyaAtGoal = roadmapAtGoal(priya, priyaRoadmap);
check(
  "a Category 1 client still gets a genuine lower-weight projection",
  priyaAtGoal !== null && priyaAtGoal !== priyaRoadmap && priyaAtGoal.weightKg === priyaRoadmap?.targetWeightKg,
  `atGoal weight ${priyaAtGoal?.weightKg} kg vs own targetWeightKg ${priyaRoadmap?.targetWeightKg} kg`
);
check(
  "...projected AS Category 4 (maintenance), same as before",
  priyaAtGoal?.category.id === 4
);

console.log(failed === 0 ? "\nall roadmap-input checks pass" : `\n${failed} FAILURES`);
process.exitCode = failed === 0 ? 0 : 1;

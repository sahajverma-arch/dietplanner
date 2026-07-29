// The merged allergy / intolerance question.
//
// This one is worth more tests than most, because the two halves of it are not
// symmetric: an allergen must NEVER appear in any meal in any form, while an
// intolerance is reduced or timed differently. Getting the split wrong in one
// direction puts a trigger food on a permanent ban list, and in the other
// direction puts an allergen on a plate.
//
// Run: npx -y tsx scripts/tests/food-problems.test.mts
import {
  allergenFoods,
  intoleranceFoods,
  hasAllergen,
  hasIntolerance,
  problemTypeId,
  PROBLEM_ALLERGY,
  PROBLEM_INTOLERANCE,
  PROBLEM_NONE,
  missingRequired,
  visibleSections,
  visibleQuestions,
  type Answers,
} from "../../src/lib/counselling/questions";
import { allergenList, toIntake, redFlags } from "../../src/lib/counselling/assessment";

let failed = 0;
const check = (name: string, pass: boolean, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${name.padEnd(58)}${detail}`);
};
const flagged = (a: Answers, needle: string) =>
  redFlags(a).some((f) => f.label.toLowerCase().includes(needle));
const intolerancesOf = (a: Answers) => toIntake(a, null).intolerances;

// --- the split ---------------------------------------------------------------
const both: Answers = {
  q27: ["Peanut", "Onion"],
  [problemTypeId("Peanut")]: PROBLEM_ALLERGY,
  [problemTypeId("Onion")]: PROBLEM_INTOLERANCE,
};
check("an allergy is an allergen", allergenFoods(both).join() === "Peanut", allergenFoods(both).join());
check("...and is not also an intolerance", !intoleranceFoods(both).includes("Peanut"));
check("an intolerance is not an allergen", !allergenFoods(both).includes("Onion"));
check("...it is a trigger food", intoleranceFoods(both).join() === "Onion");
check("both reach the plan on the right side", allergenList(both).join() === "Peanut" && intolerancesOf(both) === "Onion", `${allergenList(both)} / ${intolerancesOf(both)}`);

// --- an unclassified food fails safe ----------------------------------------
const untyped: Answers = { q27: ["Sesame"] };
check("a named but unclassified food is treated as an allergy", allergenFoods(untyped).join() === "Sesame");
check("...so it never lands in the softer list", intoleranceFoods(untyped).length === 0);

// --- "nothing to report", in every spelling this question has had ------------
for (const none of [PROBLEM_NONE, "No known allergy", "No Known Allergy", "None"])
  check(`"${none}" is not a food`, allergenFoods({ q27: [none] }).length === 0 && !flagged({ q27: [none] }, "allergy"));

// --- counsellings recorded before the merge ---------------------------------
const legacy: Answers = { q27: ["Milk"], q26: ["Onion", "Fried food", "No repeated discomfort"] };
check("a legacy q27 selection is still an allergen", allergenFoods(legacy).join() === "Milk");
check("a legacy q26 selection is still a trigger", intoleranceFoods(legacy).join() === "Onion,Fried food", intoleranceFoods(legacy).join());
check("...and its none-option is not read as a food", !intoleranceFoods(legacy).includes("No repeated discomfort"));

// --- the typed "Other" goes to whichever side it was classified as ----------
const otherAllergy: Answers = {
  q27: ["Other"], q27c: "Kiwi", [problemTypeId("Other")]: PROBLEM_ALLERGY,
};
const otherIntol: Answers = {
  q27: ["Other"], q27c: "Cabbage", [problemTypeId("Other")]: PROBLEM_INTOLERANCE,
};
check("an 'Other' allergy is banned by name", allergenList(otherAllergy).join() === "Kiwi", allergenList(otherAllergy).join());
check("an 'Other' intolerance is not", allergenList(otherIntol).length === 0 && intolerancesOf(otherIntol) === "Cabbage", intolerancesOf(otherIntol));

// --- red flags ---------------------------------------------------------------
check("an allergy raises the allergy flag", flagged(both, "known food allergy"));
check(
  "an intolerance ALONE does not",
  !flagged({ q27: ["Onion"], [problemTypeId("Onion")]: PROBLEM_INTOLERANCE }, "allergy")
);
check(
  "a severe reaction escalates only with an allergy",
  flagged({ ...both, q27a: "Anaphylaxis" }, "severe") &&
    !flagged({ q27: ["Onion"], [problemTypeId("Onion")]: PROBLEM_INTOLERANCE, q27a: "Anaphylaxis" }, "severe")
);

// --- the form itself ---------------------------------------------------------
const asked = (a: Answers) =>
  visibleSections(a).flatMap((s) => visibleQuestions(s, a)).map((q) => q.id);
check("the second food list is gone", !asked(both).includes("q26"));
check("a food that was named asks which it is", asked(both).includes(problemTypeId("Peanut")));
check("a food that was not named does not", !asked(both).includes(problemTypeId("Milk")));
check(
  "the allergy follow-ups appear for an allergy",
  ["q27d", "q27a", "q27b"].every((id) => asked(both).includes(id))
);
check(
  "...and stay hidden when nothing is an allergy",
  ["q27d", "q27a", "q27b"].every(
    (id) => !asked({ q27: ["Onion"], [problemTypeId("Onion")]: PROBLEM_INTOLERANCE }).includes(id)
  )
);
check(
  "the symptom follow-ups appear for an intolerance",
  asked(both).includes("q26a") && !asked({ q27: ["Peanut"], [problemTypeId("Peanut")]: PROBLEM_ALLERGY }).includes("q26a")
);
check(
  "classifying a named food is mandatory",
  missingRequired({ q27: ["Peanut"] }).some((m) => m.questionId === problemTypeId("Peanut")),
  missingRequired({ q27: ["Peanut"] }).map((m) => m.questionId).join(",")
);
check("hasAllergen / hasIntolerance agree with the lists", hasAllergen(both) && hasIntolerance(both));

console.log(failed === 0 ? `\nall food-problem checks pass` : `\n${failed} FAILURES`);
process.exitCode = failed === 0 ? 0 : 1;

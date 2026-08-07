// Regression test for the Quick Counselling form's core claim: a sparse
// answer set covering only the roadmap/diet-generation-relevant questions,
// run through fillUnaskedRequired(), must satisfy the SAME missingRequired()
// gate both API routes and the full form enforce — without which the quick
// form's submission would be silently rejected downstream.
//
// Run: npx -y tsx scripts/tests/quick-intake.test.mts
import { missingRequired, problemTypeId, PROBLEM_ALLERGY, type Answers } from "../../src/lib/counselling/questions";
import { fillUnaskedRequired, isQuickIntake, QUICK_INTAKE_MARKER_ID } from "../../src/lib/counselling/quick-intake";
import { roadmapFor } from "../../src/lib/counselling/roadmap-input";
import { toIntake } from "../../src/lib/counselling/assessment";

let failed = 0;
const check = (name: string, pass: boolean, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${name.padEnd(65)}${detail}`);
};

// What QuickCounsellingForm.buildSubmission() actually produces for a
// representative fill of every id in its GROUPS list.
const quickAnswers: Answers = {
  name: "Test Client",
  gender: "Female",
  phone: "+91 98765 43210",
  q9_age: "32",
  q9_height: "162",
  q9_weight: "78",
  q2: "Fat Loss",
  q76_category: "First-timer — never dieted with structure before",
  q54c: "Lightly active",
  q43: ["Walking"],
  q33: "Vegetarian",
  q27: ["Milk", "No known allergy or intolerance"].slice(0, 1), // "Milk" only
  q36: "Bitter gourd",
  q35: "Paneer, mango",
  q34: ["North Indian", "Punjabi"],
  q28: ["Breakfast", "Lunch", "Evening", "Dinner"],
  q38: ["No restriction"],
  q17: ["PCOS/PCOD"],
  q19: "No",
  q19a: "None",
  q50a: "2",
};
// The per-food allergy default buildSubmission() applies.
quickAnswers[problemTypeId("Milk")] = PROBLEM_ALLERGY;
quickAnswers[QUICK_INTAKE_MARKER_ID] = "true";

const filled = fillUnaskedRequired(quickAnswers);

const missing = missingRequired(filled);
check(
  "a representative quick-intake submission satisfies missingRequired()",
  missing.length === 0,
  missing.length ? `still missing: ${missing.map((m) => m.questionId).join(", ")}` : ""
);

check("isQuickIntake() recognizes the marker", isQuickIntake(filled));
check("isQuickIntake() is false for an ordinary answers object", !isQuickIntake({ name: "X" }));

const roadmap = roadmapFor(filled);
check(
  "a roadmap builds from just the essential fields (age/height/weight/gender/category)",
  roadmap !== null,
  roadmap ? "" : "buildRoadmap() returned null"
);

// toIntake() must not throw on a sentinel-heavy answers object — every
// downstream consumer (nim.ts, protein-intake.ts) reads through this.
let intakeThrew = false;
try {
  toIntake(filled as any);
} catch {
  intakeThrew = true;
}
check("toIntake() does not throw on a sentinel-filled answers object", !intakeThrew);

// A second call must be idempotent — filling an already-filled object should
// not change anything or loop forever (the guard in fillUnaskedRequired).
const filledTwice = fillUnaskedRequired(filled);
check(
  "fillUnaskedRequired() is idempotent",
  JSON.stringify(filledTwice) === JSON.stringify(filled)
);

// The essential fields the form itself validates client-side must survive
// fillUnaskedRequired() unchanged — it must never overwrite a real answer.
check("a real answer is never overwritten by the sentinel fill", filled.name === "Test Client");
check("q9_age survives untouched", filled.q9_age === "32");

console.log(failed === 0 ? `\nall quick-intake checks pass` : `\n${failed} FAILURES`);
process.exitCode = failed === 0 ? 0 : 1;

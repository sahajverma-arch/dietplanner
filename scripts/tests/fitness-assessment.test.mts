// The coach's six physical tests, scored 1-4 each.
//
// Every boundary from the specification is pinned here, because a threshold
// off by one silently mis-scores a client and nobody would notice: 25 push-ups
// is 2 points and 26 is 3, and a coach reading the report has no way to tell
// the table was wrong.
//
// Run: npx -y tsx scripts/tests/fitness-assessment.test.mts
import {
  fitnessAssessment,
  fitnessBand,
  bcaPoints,
  FITNESS_IDS,
} from "../../src/lib/counselling/fitness-assessment";
import type { Answers } from "../../src/lib/counselling/questions";

let failed = 0;
const check = (name: string, pass: boolean, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${name.padEnd(56)}${detail}`);
};
const pointsFor = (a: Answers, key: string) =>
  fitnessAssessment(a).tests.find((t) => t.key === key)?.points ?? null;

// --- Plank and balance: every 30 seconds is a point, capped at 4 ------------
for (const [secs, expected] of [[1, 1], [30, 1], [31, 2], [60, 2], [90, 3], [120, 4], [300, 4]] as const)
  check(`plank ${secs}s = ${expected}`, pointsFor({ [FITNESS_IDS.plankSeconds]: String(secs) }, "plank") === expected);
check("plank not attempted scores nothing", pointsFor({}, "plank") === null);
check("balance uses the same table", pointsFor({ [FITNESS_IDS.balanceSeconds]: "45" }, "balance") === 2);

// --- Push-ups: 1-15 / 16-25 / 26-35 / 36+ ----------------------------------
for (const [reps, expected] of [[1, 1], [15, 1], [16, 2], [25, 2], [26, 3], [35, 3], [36, 4], [80, 4]] as const)
  check(`${reps} push-ups = ${expected}`, pointsFor({ [FITNESS_IDS.pushupsCount]: String(reps) }, "pushups") === expected);

// --- Cardio: <0.5 / 0.5-0.8 / 0.8-1.1 / 1.2+ -------------------------------
for (const [km, expected] of [[0.4, 1], [0.5, 2], [0.8, 2], [0.9, 3], [1.1, 3], [1.2, 4], [2, 4]] as const)
  check(`cardio ${km} km = ${expected}`, pointsFor({ [FITNESS_IDS.cardioKm]: String(km) }, "cardio") === expected);

// --- Flexibility: the option chosen is the score ---------------------------
for (const [choice, expected] of [["Knee touch", 1], ["Ankle touch", 2], ["Toe touch", 3], ["Heel touch", 4]] as const)
  check(`reach "${choice}" = ${expected}`, pointsFor({ [FITNESS_IDS.reachPoints]: choice }, "reach") === expected);

// --- Body composition: different thresholds by sex -------------------------
for (const [bf, expected] of [[15, 4], [18, 4], [19, 3], [25, 3], [26, 2], [30, 2], [31, 1], [40, 1]] as const)
  check(`male ${bf}% body fat = ${expected}`, bcaPoints(bf, "Male") === expected);
for (const [bf, expected] of [[18, 4], [20, 4], [21, 3], [27, 3], [28, 2], [33, 2], [34, 1], [45, 1]] as const)
  check(`female ${bf}% body fat = ${expected}`, bcaPoints(bf, "Female") === expected);
check("the same body fat scores differently by sex", bcaPoints(20, "Male") === 3 && bcaPoints(20, "Female") === 4);
check("no sex recorded cannot pick a table", bcaPoints(22, "Prefer not to say") === null);
check(
  "body composition reads the body fat already recorded",
  pointsFor({ q15_bf: "17", gender: "Male" }, "bca") === 4
);

// --- The coach's override wins ---------------------------------------------
const overridden = fitnessAssessment({
  [FITNESS_IDS.pushupsCount]: "40",          // table says 4
  [FITNESS_IDS.pushupsPoints]: "2",          // coach says 2
});
const test = overridden.tests.find((t) => t.key === "pushups")!;
check("an explicit score beats the table", test.points === 2, `got ${test.points}`);
check("...and is marked as overridden", test.overridden);
check(
  "agreeing with the table is not an override",
  !fitnessAssessment({ [FITNESS_IDS.pushupsCount]: "40", [FITNESS_IDS.pushupsPoints]: "4" })
    .tests.find((t) => t.key === "pushups")!.overridden
);

// --- Totals are out of what was actually attempted -------------------------
const partial = fitnessAssessment({
  [FITNESS_IDS.plankSeconds]: "60",   // 2
  [FITNESS_IDS.pushupsCount]: "30",   // 3
});
check("a partial session totals what was done", partial.total === 5 && partial.possible === 8, `${partial.total}/${partial.possible}`);
check("...and counts the tests completed", partial.completed === 2);
check("a partial session has no band yet", fitnessBand(partial) === null);

const full: Answers = {
  [FITNESS_IDS.plankSeconds]: "120",  // 4
  [FITNESS_IDS.pushupsCount]: "40",   // 4
  [FITNESS_IDS.balanceSeconds]: "90", // 3
  [FITNESS_IDS.reachPoints]: "Toe touch", // 3
  q15_bf: "17", gender: "Male",       // 4
  [FITNESS_IDS.cardioKm]: "1.3",      // 4
};
const done = fitnessAssessment(full);
check("a full session scores out of 24", done.total === 22 && done.possible === 24, `${done.total}/${done.possible}`);
check("...and gets a band", fitnessBand(done) === "Excellent", String(fitnessBand(done)));
check("nothing recorded reads as not done", !fitnessAssessment({}).recorded);

console.log(failed === 0 ? `\nall fitness-assessment checks pass` : `\n${failed} FAILURES`);
process.exitCode = failed === 0 ? 0 : 1;

// Regression test for post-grounding calorie reconciliation.
//
// The decision half is pure, so the contract can be checked without a model
// call: WHICH days a correction rebuilds, and whether the result is kept.
//
// The bug this pins down: reconciliation regenerated the whole week, so a
// correction fixed the bad days and disturbed the good ones, the verified
// deviation grew, and the entire round was thrown away. On a real run that was
// 1303 -> 2102 with three days needing help and four already landing. It now
// rebuilds only the days that miss their band.
//
// Run: npx -y tsx scripts/tests/reconcile.test.mts
import { reconcileNeed, acceptRevision } from "../../src/lib/nutrition-reconcile";
import type { DietPlan } from "../../src/lib/nim";

let failed = 0;
const check = (name: string, pass: boolean, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${name.padEnd(56)}${detail}`);
};

const day = (name: string, kcal: number, p: number): DietPlan["days"][number] => ({
  day: name,
  total_calories: kcal,
  meals: [
    {
      name: "Meal", time: "", items: [{ food: "X", quantity: "1" }], notes: "",
      calories: kcal, protein_g: p, carbs_g: 0, fat_g: 0, alternates: [],
    },
  ],
});
const plan = (days: DietPlan["days"]): DietPlan => ({
  summary: "", daily_calories: 2500,
  macros: { protein_g: 90, carbs_g: 250, fat_g: 70 },
  guidelines: [], hydration: "", days, foods_to_avoid: [],
});

// The real failing week: three days off on CALORIES, four landing. Protein is
// held inside its band here so this case isolates the calorie targeting —
// over-target protein is a miss in its own right and is covered below.
const week = plan([
  day("Day 1", 2378, 100), day("Day 2", 2657, 105), day("Day 3", 2809, 104),
  day("Day 4", 3089, 108), day("Day 5", 2600, 106), day("Day 6", 3724, 110),
  day("Day 7", 3115, 102),
]);
const need = reconcileNeed(week);
check("a week with off-target days needs correcting", need.needed);
check(
  "only the off-target days are rebuilt",
  JSON.stringify(need.offTargetDays) === JSON.stringify(["Day 4", "Day 6", "Day 7"]),
  JSON.stringify(need.offTargetDays)
);
check(
  "...so the days that already land are kept",
  week.days.length - need.offTargetDays.length === 4
);
check("the instructions name the days", need.instructions.includes("Day 6"));

const good = plan(Array.from({ length: 7 }, (_, i) => day(`Day ${i + 1}`, 2500, 95)));
const noNeed = reconcileNeed(good);
check(
  "a week on target is left alone",
  !noNeed.needed && noNeed.offTargetDays.length === 0,
  noNeed.reason
);

// Under-target days count too — the correction has to push both directions.
const light = plan(Array.from({ length: 7 }, (_, i) => day(`Day ${i + 1}`, 1700, 95)));
check("under-target days are caught", reconcileNeed(light).offTargetDays.length === 7);
const lowProtein = plan(Array.from({ length: 7 }, (_, i) => day(`Day ${i + 1}`, 2500, 40)));
check("low-protein days are caught", reconcileNeed(lowProtein).offTargetDays.length === 7);

// Protein OVER the measured target is a miss too. A client measured at 70 g
// has a 79 g week-1 target so the step is one they can keep; a plan handing
// them 115 g is the jump the progression exists to avoid.
const highProtein = plan(Array.from({ length: 7 }, (_, i) => day(`Day ${i + 1}`, 2500, 115)));
const over = reconcileNeed(highProtein);
check("over-target protein days are caught", over.offTargetDays.length === 7);
check(
  "and the instruction says to reduce, not add",
  // Checks the instruction's INTENT, not its phrasing: the wording moved off
  // "the measured week-1 target" once protein became a rung on a ladder rather
  // than a single measured figure, and a test that pins prose blocks the fix.
  over.instructions.includes("OVER the 90 g target") &&
    over.instructions.includes("shrink the concentrated protein portions"),
  over.instructions.slice(over.instructions.indexOf("g protein"), over.instructions.indexOf("g protein") + 60)
);
// Comfortably above target but inside the band must still pass — the ceiling
// is 1.25x, and a naturally protein-rich day is not a defect.
const richButFine = plan(Array.from({ length: 7 }, (_, i) => day(`Day ${i + 1}`, 2500, 105)));
check("a protein-rich day inside the band passes", !reconcileNeed(richButFine).needed);

// A correction that brings protein DOWN toward target must score better.
const trimmed = plan(Array.from({ length: 7 }, (_, i) => day(`Day ${i + 1}`, 2500, 92)));
check(
  "trimming an over-protein week is accepted",
  acceptRevision(highProtein, trimmed).accept,
  acceptRevision(highProtein, trimmed).reason
);

// A correction is kept only when it verifiably helped.
const fixed = plan([
  day("Day 1", 2378, 100), day("Day 2", 2657, 105), day("Day 3", 2809, 104),
  day("Day 4", 2550, 95), day("Day 5", 2600, 106), day("Day 6", 2520, 95),
  day("Day 7", 2530, 95),
]);
check("an improved correction is accepted", acceptRevision(week, fixed).accept);
const worse = plan(week.days.map((d, i) => (i === 0 ? day("Day 1", 3900, 60) : d)));
check("a worsened correction is rejected", !acceptRevision(week, worse).accept);
// The ceiling must not demand a correction fix a breach the draft already had.
const stillHigh = plan(week.days.map((d, i) => (i === 5 ? day("Day 6", 3400, 110) : d)));
check(
  "a correction that improves but stays high is still accepted",
  acceptRevision(week, stillHigh).accept,
  acceptRevision(week, stillHigh).reason
);

console.log(failed === 0 ? `\nall reconcile checks pass` : `\n${failed} FAILURES`);
process.exitCode = failed === 0 ? 0 : 1;

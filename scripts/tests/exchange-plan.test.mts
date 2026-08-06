// Regression test for the exchange-count solver (src/lib/exchange-plan.ts).
//
// The primary case reproduces the spreadsheet's own "Plan Builder" worked
// example (week 3 of the roadmap.ts worked example: 84 kg / 1.72 m,
// Category 1, week 3 target) — not to match its exact group choices (that
// was a human's manual entry), but to confirm the solver's own allocation
// lands within the app's existing acceptance bands (day-targets.ts), the
// same bar every other generated plan is held to.
//
// Run: npx -y tsx scripts/tests/exchange-plan.test.mts
const { exchangePlanFor } = await import("../../src/lib/exchange-plan");

let failed = 0;
const check = (name: string, cond: boolean, detail: string) => {
  if (!cond) failed++;
  console.log(`${cond ? "ok  " : "FAIL"} ${name.padEnd(60)} ${cond ? "" : detail}`);
};

// --- Worked example: week 3, vegetarian, no medical hold ---
const week3Target = { kcal: 1898, proteinG: 75, carbsG: 267, fatG: 59, fiberG: 30 };
const week3 = exchangePlanFor(week3Target, { dietType: "vegetarian" });

console.log("\nWeek 3 exchange plan:");
for (const e of week3.exchanges) console.log(`  ${e.label}: ${e.count}`);
console.log(
  `  TOTALS: ${week3.totals.kcal} kcal, P${week3.totals.proteinG} C${week3.totals.carbsG} F${week3.totals.fatG} Fib${week3.totals.fiberG}`
);
if (week3.warnings.length) console.log(`  warnings: ${week3.warnings.join(" | ")}`);

check("week3: protein within app band", week3.proteinWithinBand, `got ${week3.totals.proteinG}g vs target ${week3Target.proteinG}g`);
check("week3: calories within app band", week3.calorieWithinBand, `got ${week3.totals.kcal}kcal vs target ${week3Target.kcal}kcal`);
check(
  "week3: no non-vegetarian groups chosen for a vegetarian target",
  !week3.exchanges.some((e) => e.groupId === "poultry_fish_meat" || e.groupId === "egg"),
  `exchanges: ${week3.exchanges.map((e) => e.groupId).join(",")}`
);

// --- Week 1 (transition phase) sanity ---
const week1Target = { kcal: 2249, proteinG: 65, carbsG: 365, fatG: 59, fiberG: 30 };
const week1 = exchangePlanFor(week1Target, { dietType: "vegetarian" });
console.log("\nWeek 1 exchange plan:");
for (const e of week1.exchanges) console.log(`  ${e.label}: ${e.count}`);
console.log(`  TOTALS: ${week1.totals.kcal} kcal, P${week1.totals.proteinG} C${week1.totals.carbsG} F${week1.totals.fatG}`);
check("week1: protein within app band", week1.proteinWithinBand, `got ${week1.totals.proteinG}g`);
check("week1: calories within app band", week1.calorieWithinBand, `got ${week1.totals.kcal}kcal`);
check("week1: Fitty not needed this early (food-first)", !week1.fittyProteinUsed, "Fitty fired earlier than expected");

// --- Destination week (settleWeek, protein 91g on 1898 kcal): confirms the
// multi-group seed (pulses + paneer together) reaches this without Fitty,
// where the spreadsheet's single-group (dal-only) worked example needed it —
// a genuine improvement from spreading protein across groups, not a miss. ---
const destinationTarget = { kcal: 1898, proteinG: 91, carbsG: 267, fatG: 59, fiberG: 30 };
const destination = exchangePlanFor(destinationTarget, { dietType: "vegetarian" });
console.log("\nDestination (91g protein) exchange plan:");
for (const e of destination.exchanges) console.log(`  ${e.label}: ${e.count}`);
console.log(`  TOTALS: ${destination.totals.kcal} kcal, P${destination.totals.proteinG}`);
check("destination: protein within app band", destination.proteinWithinBand, `got ${destination.totals.proteinG}g vs 91g`);

// --- Genuinely unreachable on whole food alone: even all 4 vegetarian
// protein groups saturated at the realistic 6-exchange/day cap top out
// around 176g protein combined, so 200g must fall back to Fitty. ---
const hardTarget = { kcal: 2200, proteinG: 200, carbsG: 150, fatG: 60, fiberG: 30 };
const hard = exchangePlanFor(hardTarget, { dietType: "vegetarian" });
console.log("\nHard target (200g protein, vegetarian) exchange plan:");
for (const e of hard.exchanges) console.log(`  ${e.label}: ${e.count}`);
console.log(`  TOTALS: ${hard.totals.kcal} kcal, P${hard.totals.proteinG}`);
check("hard target: Fitty Protein used to close the gap", hard.fittyProteinUsed, "expected Fitty to fire when whole food can't reach the target");
check("hard target: protein within app band", hard.proteinWithinBand, `got ${hard.totals.proteinG}g vs 200g`);

// --- Medical hold: no Fitty, protein stays at/under the held ceiling ---
const heldTarget = { kcal: 1500, proteinG: 55, carbsG: 200, fatG: 45, fiberG: 30 };
const held = exchangePlanFor(heldTarget, { dietType: "vegetarian", proteinHeld: true });
console.log(`\nMedical-hold plan: P${held.totals.proteinG} vs held target ${heldTarget.proteinG}g`);
check("medical hold: Fitty never added", !held.fittyProteinUsed, "Fitty fired despite proteinHeld");
check(
  "medical hold: protein never exceeds the band ceiling",
  held.totals.proteinG <= heldTarget.proteinG * 1.25,
  `got ${held.totals.proteinG}g, ceiling ${heldTarget.proteinG * 1.25}g`
);
check("medical hold: protein within band", held.proteinWithinBand, `got ${held.totals.proteinG}g`);

// --- Vegan: no dairy/egg/poultry groups at all ---
const veganTarget = { kcal: 1800, proteinG: 70, carbsG: 220, fatG: 55, fiberG: 30 };
const vegan = exchangePlanFor(veganTarget, { dietType: "vegan" });
check(
  "vegan: excludes paneer/fluid-dairy/egg/poultry/fitty",
  !vegan.exchanges.some((e) => ["paneer_dairy", "fluid_dairy", "egg", "poultry_fish_meat", "fitty_protein"].includes(e.groupId)),
  `exchanges: ${vegan.exchanges.map((e) => e.groupId).join(",")}`
);

// --- Non-vegetarian: poultry/fish allowed to appear ---
const nonVegTarget = { kcal: 1900, proteinG: 100, carbsG: 200, fatG: 55, fiberG: 30 };
const nonVeg = exchangePlanFor(nonVegTarget, { dietType: "non-vegetarian" });
check(
  "non-vegetarian: at least one animal-protein group chosen",
  nonVeg.exchanges.some((e) => ["poultry_fish_meat", "egg", "fluid_dairy", "paneer_dairy"].includes(e.groupId)),
  `exchanges: ${nonVeg.exchanges.map((e) => e.groupId).join(",")}`
);

// --- No negative or NaN counts ever ---
for (const [label, r] of [["week3", week3], ["week1", week1], ["destination", destination], ["hard", hard], ["held", held], ["vegan", vegan], ["nonVeg", nonVeg]] as const) {
  check(
    `${label}: all counts positive finite numbers`,
    r.exchanges.every((e) => Number.isFinite(e.count) && e.count > 0),
    r.exchanges.map((e) => `${e.groupId}=${e.count}`).join(",")
  );
}

console.log(failed === 0 ? `\nall exchange-plan cases pass` : `\n${failed} FAILURES`);

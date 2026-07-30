// The diet engine, against the standards companion it implements.
//
// Every number here comes from the spec or is worked by hand from it, because
// this module now decides what a client is told to eat. A constant drifting
// here changes every prescription the platform issues, silently and with a
// confident-looking report around it.
//
// The worked example in the companion is an 84 kg / 1.72 m man, TDEE 2,300,
// eating 2,600 — several checks below reproduce its published figures.
//
// Run: npx -y tsx scripts/tests/roadmap.test.mts
import {
  buildRoadmap,
  weekTargets,
  proteinLadder,
  settleWeek,
  band,
  categoryMeta,
  CATEGORIES,
  ENGINE_VERSION,
  type RoadmapInput,
} from "../../src/lib/roadmap";

let failed = 0;
const check = (name: string, pass: boolean, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${name.padEnd(58)}${detail}`);
};

// The companion's worked example.
const WORKED: RoadmapInput = {
  heightCm: 172,
  weightKg: 84,
  bmr: 1800,
  tdee: 2300,
  currentKcal: 2600,
  category: 1,
};
const worked = buildRoadmap(WORKED)!;

// --- Step 1: Asian-Indian bands and the target ------------------------------
for (const [bmi, expected] of [[18, "Underweight"], [21, "Normal"], [23, "Overweight"], [24.9, "Overweight"], [25, "Obese"], [31, "Obese"]] as const)
  check(`BMI ${bmi} is ${expected}`, band(bmi) === expected);
check("overweight starts at 23, not 25", band(23) === "Overweight" && band(22.9) === "Normal");

check("BMI is computed from height and weight", worked.bmi === 28.4, String(worked.bmi));
check(
  "the target is BMI 21, not the top of the range",
  worked.targetWeightKg === 62.1,
  `${worked.targetWeightKg} kg`
);
check(
  "...and the healthy range is shown either side of it",
  worked.healthyRangeKg.low === 54.7 && worked.healthyRangeKg.high === 67.7,
  `${worked.healthyRangeKg.low}–${worked.healthyRangeKg.high} kg`
);
check("weight to lose is measured to the target", worked.weightToLoseKg === 21.9, `${worked.weightToLoseKg} kg`);
check("a 5% milestone is offered", worked.milestone5pctKg === 4.2, `${worked.milestone5pctKg} kg`);

// --- Step 2: the timeline is a range ----------------------------------------
check(
  "the timeline runs 0.5–1.0% of body weight a week",
  worked.timeline!.fastestWeeks === 27 && worked.timeline!.slowestWeeks === 53,
  `${worked.timeline!.fastestWeeks}–${worked.timeline!.slowestWeeks} weeks`
);
check(
  "someone already at target has no timeline",
  buildRoadmap({ ...WORKED, weightKg: 60, heightCm: 172 })!.timeline === null
);

// --- Step 3: calories --------------------------------------------------------
check("a first-timer gets a 17.5% deficit", worked.targetKcal === 1898, `${worked.targetKcal} kcal`);
check(
  "a gap over 400 kcal gets a two-week transition",
  worked.phases.length === 2 && worked.phases[0].kcal === 2249,
  worked.phases.map((p) => p.kcal).join(" -> ")
);
check(
  "...and the transition is near maintenance, not a deficit",
  Math.abs(worked.phases[0].kcal - WORKED.tdee!) < 100,
  `${worked.phases[0].kcal} vs TDEE ${WORKED.tdee}`
);
const smallGap = buildRoadmap({ ...WORKED, currentKcal: 2100 })!;
check(
  "a gap inside normal daily variation gets no transition",
  smallGap.phases.length === 1,
  `${smallGap.phases.length} phase(s)`
);

// The BMR floor.
const tight = buildRoadmap({ ...WORKED, bmr: 2000, tdee: 2200, currentKcal: 2200 })!;
check("no target ever falls below BMR", tight.targetKcal === 2000, `${tight.targetKcal} kcal`);
check("...and the clamp is flagged", tight.warnings.some((w) => w.id === "bmr-floor"));

// --- Categories --------------------------------------------------------------
check("there are four categories", CATEGORIES.length === 4);
check(
  "the protein band is the only thing the category changes about macros",
  categoryMeta(1).proteinPerKg === 1.35 &&
    categoryMeta(2).proteinPerKg === 1.9 &&
    categoryMeta(3).proteinPerKg === 1.9 &&
    categoryMeta(4).proteinPerKg === 1.5
);

const restarter = buildRoadmap({ ...WORKED, category: 3 })!;
check("a re-starter ramps in three steps", restarter.phases.length === 3, restarter.phases.map((p) => p.kcal).join(" -> "));
check(
  "...starting at 10% and finishing at 20%",
  restarter.phases[0].kcal === 2070 && restarter.phases[2].kcal === 1840,
  `${restarter.phases[0].kcal} -> ${restarter.phases[2].kcal}`
);

// Category 2: the three adaptation tests.
const notAdapted = buildRoadmap({ ...WORKED, category: 2, currentKcal: 2100, weeksStagnant: 1 })!;
check("no adaptation test firing means audit the logging", !notAdapted.adaptation!.adapted);
check("...and the target does not move", notAdapted.phases.length === 1);
const belowBmr = buildRoadmap({ ...WORKED, category: 2, currentKcal: 1500 })!;
check("eating below BMR reads as adapted", belowBmr.adaptation!.adapted);
const stagnant = buildRoadmap({ ...WORKED, category: 2, currentKcal: 1900, weeksStagnant: 3 })!;
check("3 weeks stagnant at ≤85% of TDEE reads as adapted", stagnant.adaptation!.adapted);
check(
  "2 weeks stagnant does not — that is still noise",
  !buildRoadmap({ ...WORKED, category: 2, currentKcal: 1900, weeksStagnant: 2 })!.adaptation!.adapted
);
const longDeficit = buildRoadmap({ ...WORKED, category: 2, currentKcal: 1600, weeksOnCurrentPlan: 10, bmr: 1500 })!;
check("a steep deficit held past 8 weeks reads as adapted", longDeficit.adaptation!.adapted);
check(
  "...but the same depth for 6 weeks does not",
  !buildRoadmap({ ...WORKED, category: 2, currentKcal: 1600, weeksOnCurrentPlan: 6, bmr: 1500 })!.adaptation!.adapted
);
check("an adapted client gets a diet break first", belowBmr.phases[0].label.startsWith("Diet break"));
check("...at TDEE", belowBmr.phases[0].kcal === 2300, String(belowBmr.phases[0].kcal));
check("...then re-enters at 20%", belowBmr.phases[1].kcal === 1840, String(belowBmr.phases[1].kcal));

// Category 4: maintenance, which sometimes means eating more.
const reverse = buildRoadmap({ ...WORKED, category: 4, currentKcal: 1700 })!;
check("a 600 kcal gap reverse-diets in five steps", reverse.phases.length === 5, `${reverse.phases.length} weeks`);
check("...at 125 kcal a week", reverse.phases[0].kcal === 1825, String(reverse.phases[0].kcal));
check("...ending at TDEE", reverse.phases[4].kcal === 2300, String(reverse.phases[4].kcal));
check(
  "a gap under 300 kcal needs no protocol",
  buildRoadmap({ ...WORKED, category: 4, currentKcal: 2100 })!.phases.length === 1
);

// --- Step 4: macros ----------------------------------------------------------
check(
  "protein is dosed on adjusted weight above BMI 25",
  worked.usedAdjustedWeight && worked.dosingWeightKg === 67.6,
  `${worked.dosingWeightKg} kg`
);
check("...giving the worked example's 91 g", worked.macros.protein_g === 91, `${worked.macros.protein_g} g`);
const lean = buildRoadmap({ ...WORKED, weightKg: 68 })!;
check(
  "below BMI 25 the actual weight is used",
  !lean.usedAdjustedWeight && lean.dosingWeightKg === 68,
  `${lean.dosingWeightKg} kg`
);
check(
  "fat is the greater of 25% of calories and 0.7 g/kg",
  worked.macros.fat_g === 59,
  `${worked.macros.fat_g} g (share ${Math.round((1898 * 0.25) / 9)}, floor ${Math.round(0.7 * 84)})`
);
check("...and the floor firing is flagged", worked.warnings.some((w) => w.id === "fat-floor"));
check(
  "carbohydrate is the residual",
  worked.macros.carbs_g === Math.round((1898 - 91 * 4 - 59 * 9) / 4),
  `${worked.macros.carbs_g} g`
);
check(
  "fibre follows ICMR at 15 g per 1,000 kcal, floored at 30",
  worked.macros.fibre_g === 30,
  `${worked.macros.fibre_g} g`
);
check(
  "...and is capped at 45",
  buildRoadmap({ ...WORKED, tdee: 4200, bmr: 2000, currentKcal: 4000 })!.macros.fibre_g === 45
);

// --- Guardrails --------------------------------------------------------------
const under = buildRoadmap({ ...WORKED, weightKg: 48 })!;
check("an underweight client is a hard stop", under.warnings.some((w) => w.id === "underweight" && w.stop));
const impossible = buildRoadmap({ ...WORKED, bmr: 2400, tdee: 2300 })!;
check("TDEE below BMR is rejected as a typo", impossible.warnings.some((w) => w.id === "tdee-below-bmr" && w.stop));
check(
  "under-eating is flagged outside Category 2 as well",
  buildRoadmap({ ...WORKED, currentKcal: 1500 })!.warnings.some((w) => w.id === "chronic-under-eating")
);
check(
  "a first-timer already below target is not silently told to eat more",
  buildRoadmap({ ...WORKED, currentKcal: 1850, bmr: 1500 })!.warnings.some(
    (w) => w.id === "already-below-target"
  )
);

// --- Inputs ------------------------------------------------------------------
check("a missing category yields no roadmap", buildRoadmap({ ...WORKED, category: null }) === null);
check("missing height yields no roadmap", buildRoadmap({ ...WORKED, heightCm: null }) === null);
check("nothing recorded is not read as eating nothing", buildRoadmap({ ...WORKED, currentKcal: null })!.phases.length === 1);
check("the engine version is stamped on the result", worked.version === ENGINE_VERSION);

// --- Which week is being planned -------------------------------------------
// A first-timer's week 1 is the transition. Building week 1 to the final
// target IS the overnight cut the transition exists to prevent.
const w1 = weekTargets(worked, 1);
const w3 = weekTargets(worked, 3);
check("week 1 is planned at the transition figure", w1.kcal === 2249, `${w1.kcal} kcal`);
check("week 2 is still the transition", weekTargets(worked, 2).kcal === 2249);
check("week 3 is the full target", w3.kcal === 1898, `${w3.kcal} kcal`);
check("a later week holds the target", weekTargets(worked, 40).kcal === 1898);
check(
  "fat does not scale with the phase — the hormone floor is not weekly",
  w1.fat_g === w3.fat_g,
  `F${w1.fat_g}/${w3.fat_g}`
);

// --- The protein ladder ------------------------------------------------------
// WPI = MIN(remaining gap × 0.25, 20 g), rounded to the nearest 5 g, recomputed
// each week against the gap that is left.
check(
  "the worked formula: 20 g toward 80 g steps to 35 g in week 1",
  proteinLadder(20, 80)[0] === 35,
  String(proteinLadder(20, 80)[0])
);
check(
  "...and tapers to the target from there",
  proteinLadder(20, 80).join(",") === "35,45,55,60,65,70,75,80",
  proteinLadder(20, 80).join(",")
);
check(
  "the last rung is always the requirement, never one step short",
  [[20, 80], [26, 118], [50, 79], [12, 91], [78, 80]].every((pair) => {
    const l = proteinLadder(pair[0], pair[1]);
    return l[l.length - 1] === pair[1];
  })
);
check(
  "no week raises protein by more than 20 g",
  proteinLadder(20, 200).every((rung, i, all) => rung - (i === 0 ? 20 : all[i - 1]) <= 20),
  proteinLadder(20, 200).slice(0, 4).join(",")
);
check(
  "every step is a round 5 g, bar the last one that closes the gap",
  [[20, 80], [22, 80], [26, 118]].every((pair) => {
    const l = proteinLadder(pair[0], pair[1]);
    return l.slice(0, -1).every((rung, i) => (rung - (i === 0 ? pair[0] : l[i - 1])) % 5 === 0);
  }),
  proteinLadder(22, 80).join(",")
);
check(
  "a client already at the requirement gets it from week 1",
  proteinLadder(95, 91).join(",") === "91" && proteinLadder(91, 91).join(",") === "91"
);
check(
  "nothing measured means no ramp to build",
  proteinLadder(null, 91).join(",") === "91" && proteinLadder(0, 91).join(",") === "91"
);

// The ladder runs for all four categories — the category sets the destination,
// not the speed of approach.
for (const c of [1, 2, 3, 4] as const) {
  const r = buildRoadmap({ ...WORKED, category: c, currentProteinG: 20 })!;
  const w1 = weekTargets(r, 1).protein_g;
  check(
    `category ${c} ramps protein rather than jumping to the band`,
    w1 > 20 && w1 < r.macros.protein_g && r.proteinPath[r.proteinPath.length - 1] === r.macros.protein_g,
    `20 -> ${w1} -> ${r.macros.protein_g} g over ${r.proteinPath.length} wk`
  );
}

const ramped = buildRoadmap({ ...WORKED, currentProteinG: 20 })!;
check(
  "the requirement is still the destination, not the week-1 figure",
  ramped.macros.protein_g === 91 && ramped.proteinRequirementG === 91,
  `${ramped.macros.protein_g} g`
);
check(
  "a week past the ladder holds the requirement",
  weekTargets(ramped, 40).protein_g === 91,
  `${weekTargets(ramped, 40).protein_g} g`
);
check(
  "the energy protein has not yet claimed goes to carbohydrate",
  // Weeks 1 and 2 sit in the same calorie phase, so the only thing that moves
  // between them is the protein rung — and it trades gram for gram with carbs.
  weekTargets(ramped, 1).carbs_g - weekTargets(ramped, 2).carbs_g ===
    weekTargets(ramped, 2).protein_g - weekTargets(ramped, 1).protein_g,
  `P${weekTargets(ramped, 1).protein_g}/C${weekTargets(ramped, 1).carbs_g} -> P${weekTargets(ramped, 2).protein_g}/C${weekTargets(ramped, 2).carbs_g}`
);
check(
  "...so every week's macros still sum to that week's calories",
  [1, 2, 3, 5, 9].every((w) => {
    const t = weekTargets(ramped, w);
    return Math.abs(t.protein_g * 4 + t.fat_g * 9 + t.carbs_g * 4 - t.kcal) <= 3;
  })
);
check(
  "the settle week is the later of the ramp and the phases",
  settleWeek(ramped) === ramped.proteinPath.length && settleWeek(ramped) > 3,
  `week ${settleWeek(ramped)}`
);

// A medical hold outranks the band, on the engine path as well as the legacy one.
const renal = buildRoadmap({ ...WORKED, currentProteinG: 20, proteinCapReason: "kidney or liver condition recorded" })!;
check("a protein cap holds protein at the measured intake", renal.macros.protein_g === 20, `${renal.macros.protein_g} g`);
check("...runs no ramp at all", renal.proteinPath.join(",") === "20", renal.proteinPath.join(","));
check("...keeps the band on the record", renal.proteinRequirementG === 91);
check("...and says so", renal.warnings.some((w) => w.id === "protein-held"));
check(
  "a cap with nothing measured refuses to look safe",
  buildRoadmap({ ...WORKED, currentProteinG: null, proteinCapReason: "a protein limit is recorded" })!
    .warnings.find((w) => w.id === "protein-held")!
    .detail.includes("treating doctor")
);
const ramp = buildRoadmap({ ...WORKED, category: 3 })!;
check(
  "a re-starter's weeks step down in order, then hold",
  [1, 2, 3, 9].map((w) => weekTargets(ramp, w).kcal).join(",") === "2070,1955,1840,1840",
  [1, 2, 3, 9].map((w) => weekTargets(ramp, w).kcal).join(",")
);

console.log(failed === 0 ? `\nall roadmap checks pass` : `\n${failed} FAILURES`);
process.exitCode = failed === 0 ? 0 : 1;

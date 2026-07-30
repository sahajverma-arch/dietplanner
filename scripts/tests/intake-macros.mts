// Sanity-checks the carbs/fat/energy the counselling panel now shows, against
// the four test clients. Nothing here asserts a "correct" macro split — the
// point is that the numbers are plausible for a real eating day and that the
// three energy shares total 100%.
//
// Run: npx tsx scripts/tests/intake-macros.mts
import { estimateProteinIntake, proteinTarget } from "../../src/lib/protein-intake";
import { roadmapAtGoal, roadmapFor } from "../../src/lib/counselling/roadmap-input";
import { PRIYA, RAHUL, SNEHA, AADI } from "../test-clients";

let failures = 0;
const check = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error(`  FAIL ${msg}`);
    failures++;
  }
};

for (const [name, answers] of [
  ["PRIYA", PRIYA],
  ["RAHUL", RAHUL],
  ["SNEHA", SNEHA],
  ["AADI", AADI],
] as const) {
  const e = estimateProteinIntake(answers);
  const t = proteinTarget(answers, e);
  const s = e.energySplit;
  console.log(
    `\n${name}: ${e.gramsPerDay} g protein · ${e.carbsPerDay} g carbs · ${e.fatPerDay} g fat · ${e.kcalPerDay} kcal\n` +
      `  split ${s.protein}% P / ${s.carbs}% C / ${s.fat}% F   week-1 protein target ${t.targetG} g (${t.basis})`
  );

  // The shares are computed from the macros precisely so they total 100;
  // rounding three values to whole percent can still land on 99 or 101.
  const total = s.protein + s.carbs + s.fat;
  check(Math.abs(total - 100) <= 1, `${name} energy split totals ${total}%, expected 100`);

  // Macro-implied energy must track the database's own energy column. A wide
  // gap means a food's kcal row disagrees with its own macros.
  const implied = 4 * e.gramsPerDay + 4 * e.carbsPerDay + 9 * e.fatPerDay;
  const drift = Math.abs(implied - e.kcalPerDay) / Math.max(1, e.kcalPerDay);
  check(drift <= 0.1, `${name} macro-implied ${Math.round(implied)} kcal vs database ${e.kcalPerDay} kcal (${Math.round(drift * 100)}% apart)`);

  // A recorded eating day that lands outside this is a data-entry problem, not
  // a diet: nobody eats 400 kcal or 6000 kcal a day across a full food day.
  check(e.kcalPerDay > 600 && e.kcalPerDay < 4000, `${name} implausible energy ${e.kcalPerDay} kcal/day`);
  check(e.carbsPerDay >= e.gramsPerDay, `${name} carbs ${e.carbsPerDay} g below protein ${e.gramsPerDay} g — unusual for an Indian food day`);

  // Protein must not have moved: carbs and fat were added alongside the
  // existing figures, never in place of them.
  check(e.gramsPerDay > 0, `${name} protein estimate collapsed to zero`);
}

// ---------------------------------------------------------------------------
// The roadmap re-bases on a later weight.
//
// Every engine number is downstream of weight, so a prescription computed once
// at the counselling decays as the client succeeds: the printed target stops
// being the deficit it claims to be. These checks pin the re-basing, because
// the failure mode is silent — the plan still looks entirely correct.
// ---------------------------------------------------------------------------

console.log("\nRe-basing the roadmap on a later weight (PRIYA):");

const atCounselling = roadmapFor(PRIYA as never)!;
const startKg = Number((PRIYA as Record<string, unknown>).q9_weight);
const deficitShare = (r: typeof atCounselling) => (r.tdee - r.targetKcal) / r.tdee;

console.log(
  `  week 1   ${startKg} kg   TDEE ${atCounselling.tdee}   target ${atCounselling.targetKcal} kcal   ` +
    `${Math.round(deficitShare(atCounselling) * 100)}% deficit   protein ${atCounselling.macros.protein_g} g`
);

for (const lost of [4, 8]) {
  const now = startKg - lost;
  const rebased = roadmapFor(PRIYA as never, { weightKg: now })!;
  // What the client would really be running on if the plan never moved.
  const staleShare = (rebased.tdee - atCounselling.targetKcal) / rebased.tdee;
  console.log(
    `  −${lost} kg    ${now} kg   TDEE ${rebased.tdee}   target ${rebased.targetKcal} kcal   ` +
      `${Math.round(deficitShare(rebased) * 100)}% deficit   protein ${rebased.macros.protein_g} g` +
      `   (frozen plan would be ${Math.round(staleShare * 100)}%)`
  );

  check(rebased.tdee < atCounselling.tdee, `losing ${lost} kg must lower TDEE`);
  check(
    rebased.targetKcal < atCounselling.targetKcal,
    `losing ${lost} kg must lower the calorie target`
  );
  // The point of re-basing: the deficit stays the deficit it was prescribed as,
  // instead of decaying toward maintenance.
  check(
    Math.abs(deficitShare(rebased) - deficitShare(atCounselling)) < 0.02,
    `deficit share drifted on re-basing: ${deficitShare(atCounselling).toFixed(3)} -> ${deficitShare(rebased).toFixed(3)}`
  );
  check(
    staleShare < deficitShare(rebased),
    `the frozen plan should be a SHALLOWER deficit than the re-based one`
  );
  check(rebased.timeline!.slowestWeeks < atCounselling.timeline!.slowestWeeks, `timeline must shorten as weight falls`);
}

// Weight is the only thing re-basing changes. The category is a judgement from
// the counselling and the measured intake is a record of it; neither is
// re-derived from a number on a scale.
const rebased8 = roadmapFor(PRIYA as never, { weightKg: startKg - 8 })!;
check(rebased8.category.id === atCounselling.category.id, "re-basing must not change the category");
check(
  rebased8.current?.kcal === atCounselling.current?.kcal,
  "re-basing must not rewrite the measured intake"
);
// An absent or nonsense weight leaves the counselling roadmap untouched, so a
// follow-up that skipped the scale cannot blank the prescription.
for (const bad of [null, undefined, 0, -5, NaN]) {
  const r = roadmapFor(PRIYA as never, { weightKg: bad as number | null })!;
  check(
    r.targetKcal === atCounselling.targetKcal,
    `a weight of ${String(bad)} must fall back to the counselling weight`
  );
}

// ---------------------------------------------------------------------------
// The target-weight projection.
//
// The block a client reads last and remembers longest: "when I get there, what
// am I eating?" It must be maintenance, not the deficit carried forward — at
// BMI 21 a continued deficit prescribes weight loss into underweight, which is
// the one thing the engine's own guardrail refuses to do at the other end.
// ---------------------------------------------------------------------------

console.log("\nAt the target weight:");

for (const [name, answers] of [
  ["PRIYA", PRIYA],
  ["RAHUL", RAHUL],
  ["SNEHA", SNEHA],
  ["AADI", AADI],
] as const) {
  const base = roadmapFor(answers as never);
  if (!base) continue;
  const goal = roadmapAtGoal(answers as never, base);
  if (!goal) {
    console.log(`  ${name}: already at or below target — no projection, as intended`);
    check(base.weightToLoseKg <= 0, `${name} has weight to lose but no goal projection`);
    continue;
  }

  console.log(
    `  ${name}  ${base.weightToLoseKg} kg to lose -> ${base.targetWeightKg} kg   ` +
      `${base.targetKcal} kcal deficit now, ${goal.targetKcal} kcal maintenance at goal   ` +
      `P${base.macros.protein_g}->${goal.macros.protein_g} g`
  );

  check(goal.bmi === 21, `${name} goal projection should sit at BMI 21, got ${goal.bmi}`);
  check(goal.weightToLoseKg === 0, `${name} goal projection still has weight to lose`);
  // Maintenance means eating the day's need, not a deficit off it.
  check(
    Math.abs(goal.targetKcal - goal.tdee) < 2,
    `${name} goal projection is not maintenance: ${goal.targetKcal} vs TDEE ${goal.tdee}`
  );
  check(goal.category.id === 4, `${name} goal projection must use the maintenance category`);
  // A lighter client needs less energy — if this inverts, the re-basing is wrong.
  check(
    goal.tdee < base.tdee,
    `${name} goal TDEE ${goal.tdee} should be below the current ${base.tdee}`
  );
  check(goal.timeline === null, `${name} goal projection should have no onward timeline`);
  // Every macro has to be a real number a dietitian can read out.
  for (const [k, v] of Object.entries(goal.macros)) {
    check(Number.isFinite(v) && v > 0, `${name} goal ${k} is ${v}`);
  }
}

console.log(
  failures === 0
    ? "\nAll checks passed.\n"
    : `\n${failures} check(s) FAILED.\n`
);
process.exit(failures === 0 ? 0 : 1);

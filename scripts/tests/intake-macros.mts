// Sanity-checks the carbs/fat/energy the counselling panel now shows, against
// the four test clients. Nothing here asserts a "correct" macro split — the
// point is that the numbers are plausible for a real eating day and that the
// three energy shares total 100%.
//
// Run: npx tsx scripts/tests/intake-macros.mts
import { estimateProteinIntake, proteinTarget } from "../../src/lib/protein-intake";
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

console.log(
  failures === 0
    ? "\nAll checks passed.\n"
    : `\n${failures} check(s) FAILED.\n`
);
process.exit(failures === 0 ? 0 : 1);

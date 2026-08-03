// BMR and TDEE, shown to the client during the closing review.
//
// Pinned because these are the first numbers a client sees about their own
// body, and a sign error or a double-counted gym session is invisible in the
// UI — 1,600 and 2,100 both look plausible on screen.
//
// Run: npx -y tsx scripts/tests/energy.test.mts
import { energyEstimate, bmiBand, kcalPerSession, TEF_SHARE } from "../../src/lib/counselling/energy";
import type { Answers } from "../../src/lib/counselling/questions";

let failed = 0;
const check = (name: string, pass: boolean, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${name.padEnd(58)}${detail}`);
};

// Mifflin-St Jeor, worked by hand:
//   male 80 kg, 180 cm, 30 y = 800 + 1125 - 150 + 5   = 1780
//   female 60 kg, 165 cm, 30 y = 600 + 1031.25 - 150 - 161 = 1320.25 -> 1320
const male: Answers = { q9_weight: "80", q9_height: "180", q9_age: "30", gender: "Male" };
const female: Answers = { q9_weight: "60", q9_height: "165", q9_age: "30", gender: "Female" };

check("male BMR matches Mifflin-St Jeor", energyEstimate(male).bmr === 1780, String(energyEstimate(male).bmr));
check("female BMR matches Mifflin-St Jeor", energyEstimate(female).bmr === 1320, String(energyEstimate(female).bmr));
check(
  "the sex constant is applied, not guessed",
  (energyEstimate({ ...male, gender: "Female" }).bmr ?? 0) === 1780 - 166
);

// TDEE = (BMR x activity, plus training averaged across the week) grossed up
// for TEF, so the 10% share lands on the FINAL total, not the pre-TEF figure.
const seated = energyEstimate({ ...male, q54c: "Mostly seated" });
check(
  "sedentary TDEE is BMR x1.2, grossed up for TEF",
  seated.tdee === Math.round((1780 * 1.2) / (1 - TEF_SHARE)),
  String(seated.tdee)
);
check(
  "TEF is exactly 10% of the total, not of the pre-TEF estimate",
  seated.tefKcal === Math.round((seated.tdee ?? 0) * TEF_SHARE),
  `${seated.tefKcal} vs 10% of ${seated.tdee}`
);
const active = energyEstimate({ ...male, q54c: "Highly physical" });
check("activity level raises TDEE", (active.tdee ?? 0) > (seated.tdee ?? 0), `${seated.tdee} -> ${active.tdee}`);
// Training kcal/session = (MET - 1) x weight x duration hours, not a flat
// figure per day — an 80 kg client, "Moderate" (MET 5.0), "45–60 minutes"
// (0.875 h): (5 - 1) x 80 x 0.875 = 280 kcal/session.
const trains = energyEstimate({ ...male, q54c: "Mostly seated", q44a: "7", q44e: "Moderate", q44b: "45–60 minutes" });
check(
  "training adds on top, by intensity x duration x weight",
  trains.tdee === Math.round((1780 * 1.2 + 280) / (1 - TEF_SHARE)),
  String(trains.tdee)
);
check(
  "...and is NOT double counted into the activity factor",
  energyEstimate({ ...male, q54c: "Mostly seated", q44a: "0" }).tdee === seated.tdee
);
check("an unanswered activity level falls back to sedentary", energyEstimate(male).activityFactor === 1.2);

// kcalPerSession() directly: intensity and duration both move the figure,
// and an unanswered or unrecognised value (blank, "Variable", "Not sure")
// falls back to the same default (Light, 30-45 min) rather than erroring.
check("hard, long session costs the most", kcalPerSession(80, "Hard", "60–90 minutes") === 600, String(kcalPerSession(80, "Hard", "60–90 minutes")));
check("very light, short session costs the least", kcalPerSession(80, "Very light", "Less than 30 minutes") === 45, String(kcalPerSession(80, "Very light", "Less than 30 minutes")));
check("unanswered intensity/duration falls back to Light, 30–45 min", kcalPerSession(80, "", "") === 100, String(kcalPerSession(80, "", "")));
check("'Variable' and 'Not sure' use the same fallback as unanswered", kcalPerSession(80, "Not sure", "Variable") === kcalPerSession(80, "", ""));
check(
  "the resting hour (already inside BMR) is subtracted, not billed twice",
  kcalPerSession(80, "Moderate", "60–90 minutes") === Math.round(5 * 80 * 1.25 - 80 * 1.25),
  `net ${kcalPerSession(80, "Moderate", "60–90 minutes")} vs gross ${Math.round(5 * 80 * 1.25)}`
);

// Missing inputs must not produce a confident wrong number.
for (const [label, a] of [
  ["no weight", { ...male, q9_weight: "" }],
  ["no height", { ...male, q9_height: "" }],
  ["no age", { ...male, q9_age: "" }],
  ["no sex", { ...male, gender: "Prefer not to say" }],
] as const) {
  const e = energyEstimate(a as Answers);
  check(`${label} yields no BMR`, e.bmr === null && e.tdee === null && e.tefKcal === null);
  check(`...and says what is missing`, e.missing.length > 0, e.missing.join(", "));
}

// BMI survives a missing sex, because it does not need one.
const noSex = energyEstimate({ ...male, gender: "" });
check("BMI is still computed without sex", noSex.bmi !== null && Math.abs(noSex.bmi - 24.69) < 0.01);

// Asian-Indian cut-offs, which differ from the WHO defaults at 23 and 25.
for (const [bmi, band] of [[17, "Underweight"], [21, "Healthy"], [23, "Overweight"], [26, "Obese I"], [33, "Obese II"]] as const)
  check(`BMI ${bmi} is ${band}`, bmiBand(bmi) === band);

console.log(failed === 0 ? `\nall energy checks pass` : `\n${failed} FAILURES`);
process.exitCode = failed === 0 ? 0 : 1;

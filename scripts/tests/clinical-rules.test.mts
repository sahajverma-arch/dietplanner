// Regression test for the clinical red-flag rules.
//
// The v3.0 rewrite reworded ~40 answer options, and these rules matched with
// exact case-sensitive equality — so the rewrite silently killed 8 of 9
// urgent-symptom flags and INVERTED the doctor-instruction flag, firing it for
// every client who reported no restrictions. Each rule is therefore asserted
// against BOTH wordings, and against the none-options it must ignore.
//
// Run: npx -y tsx scripts/tests/clinical-rules.test.mts
// Every clinical rule must fire on BOTH v3.0 wording and the pre-v3.0 wording
// stored against existing clients — and must NOT fire on the none-options.
const { redFlags } = await import("../../src/lib/counselling/assessment");

const fires = (answers: any, label: string) =>
  redFlags(answers).some((f) => f.label.toLowerCase().includes(label.toLowerCase()));

type Case = [string, any, string, boolean];
const cases: Case[] = [
  // --- urgent symptoms: v3.0 wording, then legacy
  ["urgent: v3.0 Chest Pain", { q21: ["Chest Pain"] }, "chest", true],
  ["urgent: legacy chest pain", { q21: ["Chest pain or pressure"] }, "chest", true],
  ["urgent: v3.0 Palpitations", { q21: ["Palpitations"] }, "palpitations", true],
  ["urgent: legacy heartbeat", { q21: ["Irregular or very rapid heartbeat sensation"] }, "heartbeat", true],
  ["urgent: v3.0 Black Stool", { q21: ["Black Stool"] }, "black", true],
  ["urgent: case-only Blood in Stool", { q21: ["Blood in Stool"] }, "blood", true],
  ["urgent: none selected", { q21: ["None"] }, "chest", false],

  // --- the rule that INVERTED
  ["doctor instruction: v3.0 none-option must NOT flag", { q22: ["No Restrictions"] }, "doctor-given", false],
  ["doctor instruction: legacy none-option must NOT flag", { q22: ["No instruction"] }, "doctor-given", false],
  ["doctor instruction: real restriction DOES flag", { q22: ["Protein Restriction"] }, "doctor-given", true],

  // --- kidney: CKD flags, stones must not
  ["kidney: v3.0 CKD flags", { q17: ["Chronic Kidney Disease"] }, "kidney", true],
  ["kidney: legacy wording flags", { q17: ["Kidney condition"] }, "kidney", true],
  ["kidney: stones must NOT suppress protein", { q17: ["Kidney Stones"] }, "kidney", false],

  // --- liver, bariatric, allergy
  ["liver: v3.0 fatty liver", { q17: ["Fatty Liver Grade II"] }, "liver", true],
  ["bariatric: v3.0 case", { q18: ["Bariatric Surgery"] }, "bariatric", true],
  ["allergy: none-option must NOT flag", { q27: ["No Known Allergy"] }, "allergy", false],
  ["allergy: real allergen flags", { q27: ["Peanut"] }, "allergy", true],
  ["allergy: severe escalates", { q27: ["Peanut"], q27a: "Anaphylaxis" }, "severe", true],

  // --- carried-over questions that v3.0 Section 1 has no home for
  ["RED-S: carried-over q52 still flags", { q52: ["Training while eating very little"] }, "under-fuelling", true],
  ["restriction history: carried-over q13 still flags", { q13: "Yes" }, "restrictive", true],
  ["clearance: legacy cr1 still flags", { cr1: ["Senior Dietitian review required"] }, "clearance", true],
  ["clearance: v3.0 q21c equivalent flags", { q21c: "Doctor Clearance Recommended" }, "clearance", true],

  // --- pregnancy / cycle / ED
  ["pregnant", { q66: ["Pregnant"] }, "pregnant", true],
  ["cycle: 3+ months absent flags", { q66_cycle: "No period for 3+ months" }, "3+ months", true],
  ["cycle: regular must NOT flag", { q66_cycle: "Regular (25–35 days)" }, "3+ months", false],
  ["cycle: menopause must NOT flag", { q66_cycle: "Stopped — menopause" }, "3+ months", false],
  ["ED risk", { q60: ["Self-induced vomiting"] }, "disordered", true],
  ["ED review: v3.0 wording", { q60a: "Senior Clinical Review" }, "eating-behaviour", true],
];

let failed = 0;
for (const [name, answers, label, expected] of cases) {
  const got = fires(answers, label);
  if (got !== expected) failed++;
  console.log(`${got === expected ? "ok  " : "FAIL"} ${name.padEnd(52)} fired=${got} expected=${expected}`);
}
console.log(failed === 0 ? `\nall ${cases.length} clinical-rule cases pass` : `\n${failed} FAILURES`);

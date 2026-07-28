// The counselling read back on the client summary page.
//
// Pinned because this is the page a dietitian reads TO the client: a staple
// still encoded as "Roti × 2", a meal variant left as raw JSON, or a height
// shown as a bare "165" are all things the client would be read out loud. And
// an answer silently dropped here is an answer the dietitian will swear they
// recorded.
//
// Run: npx -y tsx scripts/tests/record.test.mts
import { counsellingRecord, recordSize, answerLines } from "../../src/lib/counselling/record";
import type { Answers, Question } from "../../src/lib/counselling/questions";
import { encodeVariants } from "../../src/lib/counselling/meal-variants";

let failed = 0;
const check = (name: string, pass: boolean, detail = "") => {
  if (!pass) failed++;
  console.log(`${pass ? "ok  " : "FAIL"} ${name.padEnd(58)}${detail}`);
};

const q = (partial: Partial<Question> & { id: string }): Question =>
  ({ type: "text", label: partial.id, ...partial }) as Question;

// --- one answer, formatted ---------------------------------------------------
check(
  "a plain answer comes back as itself",
  answerLines(q({ id: "name" }), { name: "  Priya Sharma " })[0] === "Priya Sharma"
);
check("an unanswered question yields no lines", answerLines(q({ id: "name" }), {}).length === 0);
check(
  "a multi-select becomes one line per choice",
  answerLines(q({ id: "q1", type: "multi" }), { q1: ["Low energy", "Health reports"] }).length === 2
);
check(
  "height carries both units",
  answerLines(q({ id: "q9_height", type: "height" }), { q9_height: "165" })[0] ===
    "165 cm · 5 ft 5 in",
  answerLines(q({ id: "q9_height", type: "height" }), { q9_height: "165" })[0]
);
check(
  "a 1-10 scale says what it is out of",
  answerLines(q({ id: "q7", type: "scale10" }), { q7: "8" })[0] === "8 / 10"
);
check(
  "staples are decoded, not shown as their storage form",
  answerLines(q({ id: "q28_lunch_staples", type: "portions" }), {
    q28_lunch_staples: ["Roti × 2", "Rice × 1"],
  }).join(", ") === "Roti × 2, Rice × 1"
);

// --- meal variants: the whole point of the page ------------------------------
const variants = encodeVariants([
  {
    id: "v1",
    label: "Bread omelette",
    items: [
      { food: "Bread", qty: "4" },
      { food: "Egg", qty: "2" },
    ],
    daysPerWeek: 3,
    measured: { calories: 420, protein_g: 21.4, carbs_g: 48, fat_g: 14 },
  },
  { id: "v2", label: "", items: [{ food: "Poha", qty: "1 bowl" }], daysPerWeek: 4 },
  // Half-written rows are real: a dietitian taps "add option" and gets called
  // away. They must not appear as an empty bullet on the client's summary.
  { id: "v3", label: "Nothing yet", items: [], daysPerWeek: 0 },
]);
const lines = answerLines(q({ id: "q112_breakfast_variants", type: "mealVariants" }), {
  q112_breakfast_variants: variants,
});
check("every recorded option gets a line", lines.length === 2, `${lines.length} lines`);
check("an option with no food is left out", !lines.join(" ").includes("Nothing yet"));
check(
  "the line reads as a sentence about the week",
  lines[0] === "Bread omelette — Bread 4, Egg 2 · 3/7 days · 21 g protein",
  lines[0]
);
check(
  "an unnamed option is named by its food",
  lines[1].startsWith("Poha — Poha 1 bowl · 4/7 days"),
  lines[1]
);
check("...and claims no protein it was never priced for", !lines[1].includes("protein"));
check(
  "unreadable stored variants do not throw",
  answerLines(q({ id: "q112_lunch_variants", type: "mealVariants" }), {
    q112_lunch_variants: "{not json",
  }).length === 0
);

// --- the whole record --------------------------------------------------------
const full: Answers = {
  name: "Priya Sharma",
  gender: "Female",
  q9_age: "32",
  q9_weight: "74",
  q9_height: "160",
  q2: "Fat Loss",
  q1: ["Low energy"],
  q54: "Desk-based",
};
const record = counsellingRecord(full);
check("the record is grouped into sections", record.length > 1, `${record.length} sections`);
check(
  "every section it returns has something in it",
  record.every((s) => s.items.length > 0)
);
check(
  "only answered questions are in it",
  recordSize(record) === Object.keys(full).length,
  `${recordSize(record)} of ${Object.keys(full).length}`
);
check(
  "client identity leads the record",
  record[0].id === "client" && record[0].items[0].id === "name"
);
check(
  "questions keep the number the form showed",
  /^\d+$/.test(record.flatMap((s) => s.items).find((i) => i.id === "q2")?.number ?? ""),
  `Q${record.flatMap((s) => s.items).find((i) => i.id === "q2")?.number}`
);
check(
  "...and the identity fields, which have none, are not given one",
  record[0].items.every((i) => i.number === "")
);
check("an empty counselling records nothing", counsellingRecord({}).length === 0);
check("...and counts as zero", recordSize(counsellingRecord({})) === 0);

// Conditional questions must not appear for a client they were never asked of.
const noAllergy = counsellingRecord({ ...full, q27: ["No known allergy"] });
check(
  "an unasked follow-up stays out",
  !noAllergy.flatMap((s) => s.items).some((i) => i.id === "q27c")
);

console.log(failed === 0 ? `\nall record checks pass` : `\n${failed} FAILURES`);
process.exitCode = failed === 0 ? 0 : 1;

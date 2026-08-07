// Regression test for regionalizeFoodName()/applyRegionalNames() (src/lib/regional-names.ts).
// Pure function tests — no NIM call, no DB call — checking the matching logic
// itself: single-bucket rename, ambiguous names left alone, no glossary = no-op.
// Run: npx tsx scripts/tests/regional-names.test.mts
const { regionalizeFoodName, applyRegionalNames } = await import("../../src/lib/regional-names");

let failed = 0;
const check = (name: string, cond: boolean, detail = "") => {
  if (!cond) failed++;
  console.log(`${cond ? "ok  " : "FAIL"} ${name.padEnd(60)} ${cond ? "" : detail}`);
};

const tamil = new Map([
  ["dal", "Paruppu"],
  ["curd", "Thayir"],
  ["buttermilk", "Mor"],
  ["rice", "Sadham"],
]);

const bengali = new Map([
  ["fish", "Maach"],
  ["fish curry", "Macher Jhol"],
  ["curd", "Doi"],
]);

check(
  "single-word food renames",
  regionalizeFoodName("Curd", tamil) === "Thayir (Curd)",
  regionalizeFoodName("Curd", tamil)
);
check(
  "compound name matches its bucket as a whole word",
  regionalizeFoodName("Moong dal", tamil) === "Paruppu (Moong dal)",
  regionalizeFoodName("Moong dal", tamil)
);
check(
  "unrecognised food is left unchanged",
  regionalizeFoodName("Bhindi sabzi", tamil) === "Bhindi sabzi",
  regionalizeFoodName("Bhindi sabzi", tamil)
);
check(
  "ambiguous name (matches two buckets) is left unchanged, not guessed",
  regionalizeFoodName("Curd rice", tamil) === "Curd rice",
  regionalizeFoodName("Curd rice", tamil)
);
check(
  "substring that isn't a whole word does not false-positive",
  regionalizeFoodName("Sandalwood tea", tamil) === "Sandalwood tea", // "dal" inside "Sandalwood" must NOT match
  regionalizeFoodName("Sandalwood tea", tamil)
);
check("empty glossary is a no-op", regionalizeFoodName("Curd", new Map()) === "Curd");

check(
  "a longer bucket that contains a shorter match wins as a refinement, not a conflict",
  regionalizeFoodName("Rohu fish curry", bengali) === "Macher Jhol (Rohu fish curry)",
  regionalizeFoodName("Rohu fish curry", bengali)
);
check(
  "the shorter bucket alone still matches when the longer one doesn't apply",
  regionalizeFoodName("Fish fry", bengali) === "Maach (Fish fry)",
  regionalizeFoodName("Fish fry", bengali)
);
check(
  "two unrelated buckets that both sit at a true edge stay ambiguous",
  regionalizeFoodName("Fish curd", bengali) === "Fish curd",
  regionalizeFoodName("Fish curd", bengali)
);
check(
  "a bucket word buried mid-description is NOT that item's identity — no rename",
  regionalizeFoodName("Chapati with dal and carrot", tamil) === "Chapati with dal and carrot",
  regionalizeFoodName("Chapati with dal and carrot", tamil)
);
check(
  "a bucket word leading a composite name still renames it",
  regionalizeFoodName("Rice with paneer and cucumber", tamil) === "Sadham (Rice with paneer and cucumber)",
  regionalizeFoodName("Rice with paneer and cucumber", tamil)
);

const plan = {
  summary: "s",
  daily_calories: 1000,
  macros: { protein_g: 1, carbs_g: 1, fat_g: 1 },
  days: [
    {
      day: "Day 1",
      total_calories: 1000,
      meals: [
        {
          time: "08:00",
          name: "Breakfast",
          calories: 500,
          protein_g: 1,
          carbs_g: 1,
          fat_g: 1,
          items: [
            { food: "Curd", quantity: "1 katori" },
            { food: "Roti", quantity: "2" },
          ],
        },
      ],
    },
  ],
} as any;

const renamed = applyRegionalNames(plan, tamil);
check(
  "applyRegionalNames renames matched items",
  renamed.days[0].meals[0].items[0].food === "Thayir (Curd)"
);
check(
  "applyRegionalNames leaves unmatched items (no Tamil term for Roti) unchanged",
  renamed.days[0].meals[0].items[1].food === "Roti"
);
check(
  "applyRegionalNames does not mutate the original plan",
  plan.days[0].meals[0].items[0].food === "Curd"
);
check(
  "applyRegionalNames does not touch quantities",
  renamed.days[0].meals[0].items[0].quantity === "1 katori"
);

console.log(failed === 0 ? "\nall regional-names cases pass" : `\n${failed} FAILURES`);
if (failed > 0) process.exit(1);

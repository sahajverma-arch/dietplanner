// Authors the meal variants for the test clients and prices them against the
// foods table, then prints the answer entries to paste into test-clients.ts.
//
// The variants are written from each client's own recorded food day, including
// the variation the old free-text rows described but could not hold — Rahul's
// "dal on non-gym days", Sneha's "paneer twice a week", Aadi's "paneer sabzi or
// dal". Those are exactly what the variant capture exists for.
//
// Run: npx -y tsx scripts/seed-variants.ts

import { readFileSync } from "node:fs";
import path from "node:path";

const envPath = path.join(__dirname, "..", ".env.local");
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

type Draft = { label: string; days: number; items: [string, string][] };

const CLIENTS: Record<string, Record<string, Draft[]>> = {
  PRIYA: {
    breakfast: [
      { label: "Poha", days: 5, items: [["Poha", "1 bowl"]] },
      { label: "Upma", days: 2, items: [["Upma", "1 bowl"]] },
    ],
    midmorning: [{ label: "Fruit", days: 7, items: [["Fruit", "1"]] }],
    lunch: [
      { label: "Roti, dal and sabzi", days: 7, items: [["Roti", "2"], ["Dal", "1 katori"], ["Sabzi", "1 katori"], ["Salad", "1 bowl"]] },
    ],
    evening: [{ label: "Tea and biscuits", days: 7, items: [["Biscuits", "4"]] }],
    dinner: [
      { label: "Roti and paneer sabzi", days: 3, items: [["Roti", "2"], ["Paneer", "100 g"]] },
      { label: "Roti, dal and sabzi", days: 4, items: [["Roti", "2"], ["Dal", "1 katori"], ["Sabzi", "1 katori"]] },
    ],
  },
  RAHUL: {
    breakfast: [{ label: "Aloo paratha and curd", days: 7, items: [["Paratha", "2"], ["Curd", "1 katori"]] }],
    lunch: [{ label: "Office thali", days: 7, items: [["Rice", "1 katori"], ["Dal", "1 katori"], ["Sabzi", "1 katori"], ["Roti", "2"]] }],
    evening: [{ label: "Tea and samosa", days: 7, items: [["Biscuits", "2"]] }],
    postworkout: [{ label: "Banana and shake", days: 4, items: [["Fruit", "1"], ["Protein powder", "1 scoop"]] }],
    // The free text said "dal on non-gym days" — two real variants.
    dinner: [
      { label: "Chicken curry and roti", days: 4, items: [["Chicken", "1 katori"], ["Roti", "2"]] },
      { label: "Dal and roti", days: 3, items: [["Dal", "1 katori"], ["Roti", "2"]] },
    ],
  },
  SNEHA: {
    breakfast: [{ label: "Roti and sabzi", days: 7, items: [["Roti", "2"], ["Sabzi", "1 katori"]] }],
    midmorning: [{ label: "Milk", days: 7, items: [["Milk", "1 glass"]] }],
    lunch: [{ label: "Rice, dal, sabzi and curd", days: 7, items: [["Rice", "1 katori"], ["Dal", "1 katori"], ["Sabzi", "1 katori"], ["Curd", "1 katori"]] }],
    evening: [{ label: "Tea and biscuits", days: 7, items: [["Biscuits", "2"]] }],
    // "paneer twice a week" — the variation the old row could only describe.
    dinner: [
      { label: "Roti and sabzi", days: 5, items: [["Roti", "2"], ["Sabzi", "1 katori"]] },
      { label: "Roti and paneer", days: 2, items: [["Roti", "2"], ["Paneer", "100 g"]] },
    ],
  },
  AADI: {
    // The exact case from the request: 3 eggs and 2 bread.
    breakfast: [{ label: "Egg omelette and bread", days: 7, items: [["Eggs", "3"], ["Bread", "2"]] }],
    lunch: [{ label: "Rice, dal, sabzi and curd", days: 7, items: [["Rice", "1 katori"], ["Dal", "1 katori"], ["Sabzi", "1 katori"], ["Curd", "1 katori"]] }],
    evening: [{ label: "Tea and biscuits", days: 7, items: [["Biscuits", "2"]] }],
    postworkout: [{ label: "Banana and boiled eggs", days: 4, items: [["Fruit", "1"], ["Eggs", "2"]] }],
    // "paneer sabzi or dal" — two variants, not one sentence.
    dinner: [
      { label: "Roti and paneer sabzi", days: 3, items: [["Roti", "3"], ["Paneer", "100 g"]] },
      { label: "Roti and dal", days: 4, items: [["Roti", "3"], ["Dal", "1 katori"]] },
    ],
  },
};

async function main() {
  const { groundMeals } = await import("../src/lib/nutrition");
  const { variantsQuestionId } = await import("../src/lib/counselling/meal-variants");
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  for (const [client, meals] of Object.entries(CLIENTS)) {
    console.log(`\n  // ---- ${client}`);
    for (const [mealKey, drafts] of Object.entries(meals)) {
      const { meals: priced, unpriced } = await groundMeals(
        supabase,
        drafts.map((d) => ({
          name: d.label, time: "", notes: "", calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0,
          alternates: [],
          items: d.items.map(([food, quantity]) => ({ food, quantity })),
        }))
      );
      const variants = drafts.map((d, i) => ({
        id: `${mealKey}${i + 1}`,
        label: d.label,
        items: d.items.map(([food, qty]) => ({ food, qty })),
        daysPerWeek: d.days,
        measured: {
          calories: Math.round(priced[i].calories),
          protein_g: Math.round(priced[i].protein_g),
          carbs_g: Math.round(priced[i].carbs_g),
          fat_g: Math.round(priced[i].fat_g),
        },
        ...(unpriced[i].length ? { unpriced: unpriced[i] } : {}),
      }));
      variants.forEach((v, i) => {
        const warn = unpriced[i].length ? `  // UNPRICED: ${unpriced[i].join(", ")}` : "";
        console.log(`  //   ${v.label} x${v.daysPerWeek}d -> ${v.measured.calories} kcal P${v.measured.protein_g}${warn}`);
      });
      console.log(
        `  "${variantsQuestionId(mealKey)}":\n    ${JSON.stringify(JSON.stringify(variants))},`
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

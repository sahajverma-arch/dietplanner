/**
 * Dev utility: renders a sample diet plan PDF without calling the AI.
 * Usage: npx tsx scripts/render-sample-pdf.tsx [output.pdf]
 */
import fs from "fs";
import { renderPlanPdf } from "../src/lib/pdf";
import type { DietPlan } from "../src/lib/nim";

const meal = (
  name: string,
  time: string,
  foods: [string, string][],
  calories: number,
  p: number,
  c: number,
  f: number,
  notes = ""
) => ({
  name,
  time,
  items: foods.map(([food, quantity]) => ({ food, quantity })),
  notes,
  calories,
  protein_g: p,
  carbs_g: c,
  fat_g: f,
});

const dayA = {
  day: "Day 1",
  total_calories: 1310,
  meals: [
    meal("Meal 1", "06:00", [["Warm water + chia seeds", "1 tsp"], ["Brazil nut", "1"], ["Walnuts", "2"], ["Sunflower seeds", "1 tbsp"]], 115, 3, 5, 10),
    meal("Breakfast", "09:30", [["Vegetable poha", "1.5 cups"], ["Curd", "100 g"]], 320, 12, 48, 9, "Use minimal oil"),
    meal("Mid-morning", "12:30", [["Cantaloupe", "200 g"]], 68, 1, 16, 0),
    meal("Lunch", "14:00", [["Dal", "1 bowl"], ["Roti", "2"], ["Kachumber salad", "1 bowl"]], 420, 18, 62, 10),
    meal("Evening", "17:00", [["Coconut water", "1 glass"]], 46, 0, 11, 0),
    meal("Dinner", "20:00", [["Grilled paneer", "150 g"], ["Sautéed vegetables", "1 cup"]], 341, 24, 12, 22),
  ],
};

const dayB = {
  day: "Day 2",
  total_calories: 1400,
  meals: [
    meal("Meal 1", "06:00", [["Warm water + chia seeds", "1 tsp"], ["Almonds", "5"]], 110, 3, 5, 9),
    meal("Breakfast", "09:30", [["Moong chilla", "2"], ["Mint chutney", "2 tbsp"]], 310, 16, 40, 8),
    meal("Mid-morning", "12:30", [["Papaya", "200 g"]], 86, 1, 22, 0),
    meal("Lunch", "14:00", [["Rajma", "1 bowl"], ["Brown rice", "1 cup"], ["Salad", "1 bowl"]], 460, 20, 74, 8),
    meal("Evening", "17:00", [["Buttermilk", "1 glass"]], 60, 3, 5, 3),
    meal("Dinner", "20:00", [["Palak paneer", "1 bowl"], ["Roti", "1"]], 374, 18, 28, 20),
  ],
};

const days = [dayA, dayB, dayA, dayB, dayA, dayB, dayA].map((d, i) => ({
  ...d,
  day: `Day ${i + 1}`,
}));

const plan: DietPlan = {
  summary:
    "A vegetarian weight-loss plan built around familiar North Indian home food. It keeps protein high with paneer, dal and moong, uses low-GI carbs, and stays gentle on digestion with an early, light dinner.",
  daily_calories: 1350,
  macros: { protein_g: 75, carbs_g: 150, fat_g: 48 },
  guidelines: [
    "Eat slowly and stop at 80% fullness",
    "No sugar in tea or coffee; max 2 cups a day",
    "Finish dinner by 8:30 PM",
    "10-minute walk after every main meal",
  ],
  hydration: "2.5–3 litres of water daily; start the day with 2 glasses of warm water.",
  days,
  foods_to_avoid: ["Fried snacks", "Sugary drinks", "Maida (refined flour)", "Packaged namkeen"],
};

async function main() {
  const out = process.argv[2] || "sample-plan.pdf";
  const buf = await renderPlanPdf({
    plan,
    clientName: "Anita Verma",
    weekNumber: 1,
    dietitianName: "rayan.ranaut@fitelo.co",
    generatedOn: "9 July 2026",
    startDateIso: "2026-07-13T00:00:00.000Z",
    dietType: "vegetarian",
    conditions: ["Thyroid (hypo/hyper)", "PCOS / PCOD"],
  });
  fs.writeFileSync(out, buf);
  console.log("wrote", out, buf.length, "bytes");
}

main();

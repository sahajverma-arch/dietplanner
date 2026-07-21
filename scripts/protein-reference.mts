// Regenerates PROTEIN_REFERENCE in src/lib/nutrition.ts from the live foods
// table. That table is pasted into the generation prompt so the model plans
// protein against the same numbers grounding will hold it to; run this after
// changing staples.json (a remapped alias silently changes what "1 katori of
// dal" is worth) and paste the printed literal back into nutrition.ts.
//
// Run: npx tsx scripts/protein-reference.mts
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

const { normName, fetchBestMatches } = await import("../src/lib/nutrition");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// [database query, label for the prompt, portion label, grams]. Ordered
// low-to-high protein so the printed table reads as a ladder: the staples the
// model over-credits first, the concentrated sources it under-uses last.
const PORTIONS: [string, string, string, number][] = [
  ["Roti", "Roti", "1 roti", 36],
  ["Dal", "Dal", "1 katori (150 g)", 150],
  ["Rice", "Rice", "1 cup (150 g)", 150],
  ["Curd", "Curd", "1 katori (150 g)", 150],
  ["Milk", "Milk", "1 glass (200 ml)", 200],
  ["Chana masala", "Rajma / chana masala", "1 katori (150 g)", 150],
  ["Besan chilla", "Besan chilla", "2 chilla", 104],
  ["Roasted chana", "Roasted chana", "40 g", 40],
  ["Tofu", "Tofu", "100 g", 100],
  ["Egg", "Eggs", "2 eggs", 100],
  ["Soya chunks curry", "Soya chunks curry", "150 g", 150],
  ["Chicken curry", "Chicken curry", "150 g", 150],
  ["Paneer", "Paneer", "100 g", 100],
  ["Whey shake", "Whey shake", "1 scoop (30 g)", 30],
  ["Grilled fish", "Grilled fish", "100 g", 100],
  ["Grilled chicken", "Grilled chicken", "100 g", 100],
];

const matches = await fetchBestMatches(supabase as any, PORTIONS.map((p) => p[0]));
const rows: string[] = [];
for (const [query, label, portion, grams] of PORTIONS) {
  const m = matches.get(normName(query));
  if (!m) {
    console.error(`!! "${query}" has no database match — fix staples.json before pasting this table`);
    continue;
  }
  const protein = Math.round(((m.protein_g * grams) / 100) * 10) / 10;
  rows.push(
    `  { food: ${JSON.stringify(label)}, portion: ${JSON.stringify(portion)}, protein_g: ${protein} },` +
      ` // ${m.name}`
  );
}

console.log("Paste into src/lib/nutrition.ts (PROTEIN_REFERENCE), dropping the trailing comments:\n");
console.log(rows.join("\n"));

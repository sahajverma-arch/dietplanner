// Regenerates the per-portion nutrition in src/lib/protein-intake.ts —
// PROTEIN_FOODS (the Q50 foods) and STAPLE_PROTEIN (the Q28 food-day staples)
// — from the live foods table, now with carbs, fat and calories alongside the
// protein those tables already carried.
//
// Self-checking by design: every row prints the protein it computes NEXT TO
// the protein currently hardcoded in protein-intake.ts. A row marked OK means
// the database row this script matched is the same one the existing protein
// number came from, so its carbs and fat can be trusted as the same food. A
// row marked DRIFT means the query or the portion weight here does not
// reproduce the current figure — fix it before pasting anything, or the panel
// will show a client's carbs from one food and their protein from another.
//
// Run: npx tsx scripts/intake-reference.mts
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

const { normName, fetchBestMatches } = await import("../src/lib/nutrition");
const { PROTEIN_FOODS } = await import("../src/lib/protein-intake");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// The database query for each Q50 food, and the weight of one standard
// portion. The query is NOT the label: "Chicken" is priced as chicken curry
// because home eating is curry (see PROTEIN_FOODS), and a label like "Nuts or
// seeds" has no database row under that name.
const FOOD_QUERIES: Record<string, { query: string; grams: number }> = {
  milk: { query: "Milk", grams: 200 },
  curd: { query: "Curd", grams: 150 },
  greek: { query: "Greek yogurt", grams: 170 },
  buttermilk: { query: "Buttermilk", grams: 250 },
  paneer: { query: "Paneer", grams: 100 },
  tofu: { query: "Tofu", grams: 100 },
  soy: { query: "Soya chunks curry", grams: 150 },
  tempeh: { query: "Tempeh", grams: 100 },
  dal: { query: "Dal", grams: 150 },
  chole: { query: "Chana masala", grams: 150 },
  rajma: { query: "Rajma", grams: 150 },
  sprouts: { query: "Sprouts", grams: 100 },
  chana: { query: "Roasted chana", grams: 40 },
  // Peanuts, not almonds: the label is "Nuts or seeds" and a peanut-priced
  // handful is what the current 7.7 g figure reproduces. Peanuts are also the
  // nut actually eaten by handful in most Indian households.
  nuts: { query: "Peanuts", grams: 30 },
  powder: { query: "Whey shake", grams: 30 },
  eggs: { query: "Egg", grams: 100 },
  fish: { query: "Fish curry", grams: 150 },
  seafood: { query: "Prawn curry", grams: 150 },
  chicken: { query: "Chicken curry", grams: 150 },
  meat: { query: "Mutton curry", grams: 150 },
};

// The Q28 staples. `grams` is one unit — one roti, one katori, one slice —
// and `current` is the protein per unit hardcoded in STAPLE_PROTEIN today.
const STAPLE_QUERIES: { label: string; query: string; grams: number; current: number }[] = [
  { label: "Roti", query: "Roti", grams: 36, current: 2.1 },
  { label: "Paratha", query: "Paratha", grams: 60, current: 4.1 },
  { label: "Rice", query: "Rice", grams: 150, current: 3.9 },
  { label: "Poha", query: "Poha", grams: 100, current: 4.8 },
  { label: "Bread", query: "Bread", grams: 25, current: 3.1 }, // one slice
  { label: "Idli", query: "Idli", grams: 40, current: 1.9 }, // one idli
  { label: "Dosa", query: "Dosa", grams: 90, current: 9.3 }, // one plain dosa
  { label: "Upma", query: "Upma", grams: 150, current: 3.9 },
  { label: "Khichdi", query: "Khichdi", grams: 150, current: 2.6 },
  { label: "Chilla", query: "Besan chilla", grams: 52, current: 4.1 },
  { label: "Sabzi", query: "Mixed vegetable sabzi", grams: 150, current: 4.2 },
  { label: "Salad", query: "Salad", grams: 100, current: 1.2 },
  { label: "Biscuits", query: "Biscuit", grams: 10, current: 0.4 },
  { label: "Fruit", query: "Banana", grams: 100, current: 1.0 },
];

const r1 = (n: number) => Math.round(n * 10) / 10;

const allQueries = [
  ...Object.values(FOOD_QUERIES).map((f) => f.query),
  ...STAPLE_QUERIES.map((s) => s.query),
];
const matches = await fetchBestMatches(supabase as any, allQueries);

let drift = 0;
const price = (query: string, grams: number, current: number) => {
  const m = matches.get(normName(query));
  if (!m) {
    console.error(`  !! "${query}" has no database match — fix staples.json first`);
    drift++;
    return null;
  }
  const per = (v: number) => r1((v * grams) / 100);
  const protein = per(m.protein_g);
  // Tolerance is one decimal place of rounding either way, plus a little for
  // portion weights that were originally taken to the nearest 5 g.
  const ok = Math.abs(protein - current) <= Math.max(0.3, current * 0.05);
  if (!ok) drift++;
  return {
    protein,
    carbs: per(m.carbs_g),
    fat: per(m.fat_g),
    kcal: Math.round((m.kcal * grams) / 100),
    name: m.name,
    ok,
  };
};

console.log("\n=== PROTEIN_FOODS — paste protein/carbs/fat into src/lib/protein-intake.ts ===\n");
for (const food of PROTEIN_FOODS) {
  const q = FOOD_QUERIES[food.id];
  if (!q) {
    console.error(`  !! no query mapped for "${food.id}" — add one to FOOD_QUERIES`);
    drift++;
    continue;
  }
  const p = price(q.query, q.grams, food.proteinPerPortion);
  if (!p) continue;
  console.log(
    `  { id: "${food.id}", proteinPerPortion: ${p.protein}, carbsPerPortion: ${p.carbs}, fatPerPortion: ${p.fat}, kcalPerPortion: ${p.kcal} },` +
      `  // ${p.ok ? "OK  " : "DRIFT"} protein now ${food.proteinPerPortion} -> ${p.protein} | ${p.name}`
  );
}

console.log("\n=== STAPLE_PROTEIN — per unit ===\n");
for (const s of STAPLE_QUERIES) {
  const p = price(s.query, s.grams, s.current);
  if (!p) continue;
  console.log(
    `  { label: "${s.label}", perUnit: ${p.protein}, carbsPerUnit: ${p.carbs}, fatPerUnit: ${p.fat}, kcalPerUnit: ${p.kcal} },` +
      `  // ${p.ok ? "OK  " : "DRIFT"} protein now ${s.current} -> ${p.protein} | ${p.name}`
  );
}

console.log(
  drift === 0
    ? "\nAll rows reproduce the protein currently in protein-intake.ts — safe to paste.\n"
    : `\n${drift} row(s) DRIFT from the protein in protein-intake.ts. Fix the query or portion weight above before pasting.\n`
);

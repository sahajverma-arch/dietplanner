// Finds foods that MATCH the database but still contribute nothing to a meal's
// macros — the silent failure behind "2 moong dal chilla = 27 kcal".
//
// A wrong match is loud (match-audit.ts catches those). This is the quiet one:
// the name resolves fine, so every "did it match?" check says yes, while the
// item is dropped because its quantity will not convert to grams or prices
// past the per-item calorie ceiling. Usually the matched row's serving weight
// is a plateful rather than a piece ("Moong dal stuffed cheela" = 227 g), which
// a staples.json serving_g override fixes.
//
// Every item name+quantity actually used in a saved plan is re-priced through
// the real grounder, so the report reflects production behaviour exactly.
//
// Run: npx -y tsx scripts/audit-unpriceable.ts

import { readFileSync } from "node:fs";
import path from "node:path";

const envPath = path.join(__dirname, "..", ".env.local");
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

// Quantities to probe when a name has never been written with one.
const PROBES = ["1", "2", "1 katori", "1 bowl"];

async function main() {
  const { groundMeals, fetchBestMatches, normName } = await import("../src/lib/nutrition");
  const { createClient } = await import("@supabase/supabase-js");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: rows, error } = await supabase.from("diet_plans").select("plan");
  if (error) throw new Error(error.message);

  // Every (food, quantity) pair a dietitian has actually shipped.
  const pairs = new Map<string, { food: string; quantity: string }>();
  for (const row of rows ?? []) {
    const plan = row.plan as { days?: { meals?: { items?: { food: string; quantity: string }[] }[] }[] };
    for (const day of plan?.days ?? [])
      for (const meal of day.meals ?? [])
        for (const item of meal.items ?? []) {
          if (!item?.food) continue;
          const quantity = (item.quantity || "").trim() || "1";
          pairs.set(`${item.food.toLowerCase()}|${quantity.toLowerCase()}`, {
            food: item.food,
            quantity,
          });
        }
  }
  // Probe the staple names too — the AI writes these constantly.
  const staples = JSON.parse(
    readFileSync(path.join(__dirname, "data", "staples.json"), "utf8")
  ) as { staples: { name: string }[] };
  for (const s of staples.staples)
    for (const q of PROBES)
      pairs.set(`${s.name.toLowerCase()}|${q}`, { food: s.name, quantity: q });

  const all = Array.from(pairs.values());
  console.log(`re-pricing ${all.length} (food, quantity) pairs from ${rows?.length ?? 0} saved plans\n`);

  // One item per meal, so `unpriced` names exactly the failing item.
  const unpriceable = new Map<string, Set<string>>();
  const BATCH = 60;
  for (let i = 0; i < all.length; i += BATCH) {
    const batch = all.slice(i, i + BATCH);
    const { unpriced } = await groundMeals(
      supabase,
      batch.map((p) => ({
        name: "Probe",
        time: "",
        items: [p],
        notes: "",
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        alternates: [],
      }))
    );
    unpriced.forEach((names, j) => {
      if (!names.length) return;
      const key = batch[j].food;
      if (!unpriceable.has(key)) unpriceable.set(key, new Set());
      unpriceable.get(key)!.add(batch[j].quantity);
    });
  }

  if (unpriceable.size === 0) {
    console.log("nothing unpriceable — every item contributes to its meal");
    return;
  }

  // Why: no row at all, or a row whose serving weight makes the quantity absurd.
  const matches = await fetchBestMatches(supabase, Array.from(unpriceable.keys()));
  const noRow: string[] = [];
  const badServing: { food: string; match: string; serving: number | null; kcal: number; quantities: string[] }[] = [];

  // Array.from rather than iterating the Map directly: the project targets a
  // pre-ES2015 lib for tsc, so Map/Set iteration needs downlevelIteration.
  for (const [food, quantities] of Array.from(unpriceable.entries())) {
    const m = matches.get(normName(food));
    if (!m) {
      noRow.push(food);
    } else {
      badServing.push({
        food,
        match: m.name,
        serving: m.serving_g,
        kcal: m.kcal,
        quantities: Array.from(quantities.values()).sort(),
      });
    }
  }

  if (badServing.length) {
    console.log(`=== MATCHED but unpriceable (${badServing.length}) — staples.json serving_g override ===`);
    badServing.sort((a, b) => b.quantities.length - a.quantities.length);
    for (const b of badServing) {
      const per = b.serving ? Math.round((b.kcal * b.serving) / 100) : null;
      console.log(
        `  ${b.food}\n     -> "${b.match}"  serving=${b.serving ?? "null"}g  ` +
          `${b.kcal.toFixed(0)} kcal/100g${per ? ` = ${per} kcal/serving` : ""}\n` +
          `     fails at: ${b.quantities.join(", ")}`
      );
    }
  }
  if (noRow.length) {
    console.log(`\n=== NO database row (${noRow.length}) — needs a staples.json alias ===`);
    for (const f of noRow.sort()) console.log(`  ${f}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

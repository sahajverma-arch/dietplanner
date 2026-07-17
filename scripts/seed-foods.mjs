// Seeds the public.foods table from the committed reference data:
//   scripts/data/indb_foods.json  — INDB Indian recipes (Anuvaad / ICMR-NIN IFCT 2017)
//   scripts/data/usda_foods.json  — USDA FoodData Central SR Legacy (public domain)
//
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (Supabase Dashboard ->
// Project Settings -> API -> service_role). Run: npm run seed:foods
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvLocal() {
  let text;
  try {
    text = readFileSync(join(root, ".env.local"), "utf8");
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.\n" +
      "The service role key is under Supabase Dashboard -> Project Settings -> API."
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BATCH = 500;

// A number of INDB rows carry data-entry errors (e.g. Boondi raita listed at
// ~2,260 kcal per bowl, Cheese toast at 785 kcal/100g with 84 g fat). A
// calorie-dense value (>550/100g) is only plausible for small servings (nuts,
// oils, dry snacks, all <90 g) — dense AND a 90 g+ serving means 800-1,200
// kcal for one poori/toast/chilla, which is an error. USDA rows are not
// filtered.
function isCorruptIndbRow(f) {
  return f.kcal > 550 && f.serving_g != null && f.serving_g > 90;
}

// Rows that are technically valid but unrepresentative for diet planning, so
// the plain name resolves to the everyday preparation instead. BFP044 "Poha"
// is the heavily-oiled version (294.5 kcal/100g, 14 g fat) — three dietitian
// reviews flagged breakfasts built on it; excluding it makes "poha" resolve
// to Vegetable poha (BFP045, 180.5 kcal/100g).
const CURATED_EXCLUDE = new Set(["BFP044"]);

async function seedFile(file) {
  let { source, foods } = JSON.parse(readFileSync(join(root, "scripts", "data", file), "utf8"));
  if (source === "INDB") {
    const excluded = (f) => isCorruptIndbRow(f) || CURATED_EXCLUDE.has(String(f.source_id));
    const bad = foods.filter(excluded);
    if (bad.length) {
      console.log(`INDB: excluding ${bad.length} rows (implausible values or curated out):`);
      bad.forEach((f) => console.log(`  - ${f.name} (${f.kcal} kcal/100g, ${f.serving_g} g serving)`));
      const { error } = await supabase
        .from("foods")
        .delete()
        .eq("source", "INDB")
        .in("source_id", bad.map((f) => String(f.source_id)));
      if (error) console.warn(`INDB: cleanup delete failed: ${error.message}`);
      foods = foods.filter((f) => !excluded(f));
    }
  }
  console.log(`${source}: seeding ${foods.length} foods…`);

  for (let i = 0; i < foods.length; i += BATCH) {
    const rows = foods.slice(i, i + BATCH).map((f) => ({
      source,
      source_id: String(f.source_id),
      name: f.name,
      food_group: f.group ?? null,
      kcal: f.kcal ?? 0,
      protein_g: f.protein_g ?? 0,
      carbs_g: f.carbs_g ?? 0,
      fat_g: f.fat_g ?? 0,
      fiber_g: f.fiber_g,
      serving_unit: f.serving_unit,
      serving_g: f.serving_g,
      micros: f.micros ?? {},
    }));
    const { error } = await supabase
      .from("foods")
      .upsert(rows, { onConflict: "source,source_id" });
    if (error) {
      console.error(`${source}: batch at ${i} failed: ${error.message}`);
      process.exit(1);
    }
    process.stdout.write(`  ${Math.min(i + BATCH, foods.length)}/${foods.length}\r`);
  }
  console.log(`\n${source}: done.`);
}

// Curated staples: extra rows with exact everyday names ("Banana", "Roti",
// "Curd") copying nutrients from a canonical INDB/USDA food, so short generic
// queries beat longer recipe names ("Banana appam") in fuzzy matching.
async function seedStaples() {
  const byRef = new Map();
  for (const file of ["indb_foods.json", "usda_foods.json"]) {
    const { source, foods } = JSON.parse(
      readFileSync(join(root, "scripts", "data", file), "utf8")
    );
    for (const f of foods) byRef.set(`${source}:${f.source_id}`, f);
  }

  const { staples } = JSON.parse(
    readFileSync(join(root, "scripts", "data", "staples.json"), "utf8")
  );
  const rows = [];
  for (const s of staples) {
    const ref = byRef.get(`${s.source}:${s.source_id}`);
    if (!ref) {
      console.warn(`staples: ${s.name} -> ${s.source}:${s.source_id} not found, skipped`);
      continue;
    }
    rows.push({
      source: s.source,
      source_id: `alias:${s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name: s.name,
      food_group: ref.group ?? null,
      kcal: ref.kcal ?? 0,
      protein_g: ref.protein_g ?? 0,
      carbs_g: ref.carbs_g ?? 0,
      fat_g: ref.fat_g ?? 0,
      fiber_g: ref.fiber_g,
      serving_unit: s.serving_unit ?? ref.serving_unit,
      serving_g: s.serving_g ?? ref.serving_g,
      micros: ref.micros ?? {},
    });
  }
  // Alias rows are fully derived from staples.json — delete existing ones
  // first. An alias remapped to the other source ("Paneer bhurji" INDB→USDA)
  // would otherwise leave its old row behind under the previous source, and
  // exact-name ranking can keep picking the stale copy.
  const { error: delError } = await supabase.from("foods").delete().like("source_id", "alias:%");
  if (delError) console.warn(`staples: stale-alias cleanup failed: ${delError.message}`);

  const { error } = await supabase.from("foods").upsert(rows, { onConflict: "source,source_id" });
  if (error) {
    console.error(`staples: upsert failed: ${error.message}`);
    process.exit(1);
  }
  console.log(`staples: ${rows.length} curated rows seeded.`);
}

await seedFile("indb_foods.json");
await seedFile("usda_foods.json");
await seedStaples();

const { count } = await supabase.from("foods").select("*", { count: "exact", head: true });
console.log(`foods table now holds ${count} rows.`);

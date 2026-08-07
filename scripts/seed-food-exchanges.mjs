// Seeds public.food_exchange_groups and public.food_exchanges from the
// committed reference data: scripts/data/food_exchanges.json (transcribed
// from the Fitelo exchange-list spreadsheet — DRAFT, not clinically reviewed).
//
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (Supabase Dashboard ->
// Project Settings -> API -> service_role). Run: npm run seed:food-exchanges
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

// ---------------------------------------------------------------------------
// diet_tags inference. Not in the source spreadsheet — the sheet only
// distinguishes veg/non-veg via group. Derived here, in one visible place,
// rather than hand-annotated per row: a group-level default, with a small
// override list for the two cases the group default gets wrong (root
// vegetables are excluded from Jain; ghee/butter are dairy, not vegan).
// Inference, not a nutrition-team ruling — flagged in the migration comment.
//
// Tag spelling matches the app's existing DietType union in src/lib/types.ts
// ("vegetarian" | "non-vegetarian" | "vegan" | "eggetarian", hyphenated) plus
// "jain" as a separate flag, the same way DIET_TYPE mapping in
// src/lib/counselling/assessment.ts maps a Jain client to dietType
// "vegetarian" and leaves the root-vegetable/egg exclusion to a distinct
// signal — so the solver can consume these tags with no translation layer.
// ---------------------------------------------------------------------------
const DIET_TYPES = ["vegetarian", "eggetarian", "non-vegetarian", "vegan", "jain"];

const GROUP_DEFAULT_TAGS = {
  pulses_legumes: ["vegetarian", "eggetarian", "non-vegetarian", "vegan", "jain"],
  soya_plant_protein: ["vegetarian", "eggetarian", "non-vegetarian", "vegan", "jain"],
  paneer_dairy: ["vegetarian", "eggetarian", "non-vegetarian", "jain"],
  fluid_dairy: ["vegetarian", "eggetarian", "non-vegetarian", "jain"],
  egg: ["eggetarian", "non-vegetarian"],
  poultry_fish_meat: ["non-vegetarian"],
  // Protein source (whey vs plant blend) isn't stated on the label excerpt we
  // have, so vegan/Jain are deliberately left off rather than guessed.
  fitty_protein: ["vegetarian", "eggetarian", "non-vegetarian"],
  cereals_starches: ["vegetarian", "eggetarian", "non-vegetarian", "vegan", "jain"],
  vegetables: ["vegetarian", "eggetarian", "non-vegetarian", "vegan", "jain"],
  fruit: ["vegetarian", "eggetarian", "non-vegetarian", "vegan", "jain"],
  fats_oils: ["vegetarian", "eggetarian", "non-vegetarian", "vegan", "jain"],
  nuts_seeds: ["vegetarian", "eggetarian", "non-vegetarian", "vegan", "jain"],
};

// Root vegetables: not Jain.
const NOT_JAIN = new Set(["Potato", "Sweet potato", "Onion / pyaz", "Carrot / gajar", "Mooli / radish"]);
// Dairy fat: not vegan (still Jain-safe, so only drop "vegan" from the default).
const NOT_VEGAN = new Set(["Ghee (desi)", "Butter (Amul)"]);

function dietTagsFor(groupId, name) {
  let tags = GROUP_DEFAULT_TAGS[groupId] ?? [];
  if (NOT_JAIN.has(name)) tags = tags.filter((t) => t !== "jain");
  if (NOT_VEGAN.has(name)) tags = tags.filter((t) => t !== "vegan");
  return tags;
}

async function main() {
  const { groups, exchanges } = JSON.parse(
    readFileSync(join(root, "scripts", "data", "food_exchanges.json"), "utf8")
  );

  console.log(`Seeding ${groups.length} exchange groups...`);
  const groupRows = groups.map((g) => ({
    id: g.id,
    label: g.label,
    sort_order: g.sortOrder,
    protein_g: g.proteinG,
    carbs_g: g.carbsG,
    fat_g: g.fatG,
    fiber_g: g.fiberG,
    standard_serving: g.standardServing,
  }));
  {
    const { error } = await supabase.from("food_exchange_groups").upsert(groupRows, { onConflict: "id" });
    if (error) {
      console.error(`food_exchange_groups: failed: ${error.message}`);
      process.exit(1);
    }
  }

  console.log(`Seeding ${exchanges.length} food exchanges...`);
  const exchangeRows = exchanges.map((e) => ({
    group_id: e.group,
    name: e.name,
    serving_g: e.servingG,
    household_measure: e.householdMeasure || null,
    protein_g: e.proteinG,
    carbs_g: e.carbsG,
    fat_g: e.fatG,
    fiber_g: e.fiberG,
    diet_tags: dietTagsFor(e.group, e.name),
    notes: e.notes || null,
  }));
  const { error } = await supabase
    .from("food_exchanges")
    .upsert(exchangeRows, { onConflict: "group_id,name" });
  if (error) {
    console.error(`food_exchanges: failed: ${error.message}`);
    process.exit(1);
  }

  await seedFoodsTableRows(groups, exchanges);

  console.log("Done.");
}

const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/**
 * public.foods stores nutrients PER 100 G; food_exchanges stores them PER
 * SERVING (per exchange) — copying one straight into the other without
 * converting would misprice every exchange food by roughly serving_g/100,
 * silently. This is the whole reason for this second seed step: existing
 * grounding code (nutrition.ts, unmodified) reads public.foods as per-100g,
 * so migration 0013's match_foods_batch boost only pays off if these rows
 * actually speak that convention.
 */
function per100g(valuePerServing, servingG) {
  return Math.round((valuePerServing / servingG) * 100 * 100) / 100;
}

/**
 * Mirrors the 88 exchange foods into public.foods (source='EXCHANGE',
 * source_id='exchange:<group>:<slug>'), so the SAME grounding pipeline that
 * already matches every other meal item (nutrition.ts, match-audit.ts) can
 * land on these curated, brand-robust values — match_foods_batch (migration
 * 0016) matches exclusively against these rows.
 *
 * Where an item carries an `alias` (the short name used in nim.ts's
 * EXCHANGE_FOOD_EXAMPLES, e.g. "Moong dal" for "Moong dal (yellow), raw"), a
 * SECOND row is seeded under that shorter name, so a full descriptive name
 * alone still gets an exact-text-match hit for the short everyday query. The
 * alias row carries the SAME exchange-precise macros but the short name the
 * model is actually prompted to write, so it wins the exact match on its own
 * merits.
 */
async function seedFoodsTableRows(groups, exchanges) {
  const labelById = new Map(groups.map((g) => [g.id, g.label]));

  const toRow = (e, name, idSuffix) => ({
    source: "EXCHANGE",
    source_id: `exchange:${e.group}:${slugify(name)}${idSuffix}`,
    name,
    food_group: labelById.get(e.group) ?? e.group,
    kcal: per100g(e.proteinG * 4 + e.carbsG * 4 + e.fatG * 9, e.servingG),
    protein_g: per100g(e.proteinG, e.servingG),
    carbs_g: per100g(e.carbsG, e.servingG),
    fat_g: per100g(e.fatG, e.servingG),
    fiber_g: per100g(e.fiberG, e.servingG),
    serving_unit: e.householdMeasure || null,
    serving_g: e.servingG,
    cuisine_tags: ["Pan-Indian"],
    micros: {},
  });

  const rows = exchanges.flatMap((e) => {
    const out = [toRow(e, e.name, "")];
    if (e.alias) out.push(toRow(e, e.alias, "-alias"));
    return out;
  });
  console.log(`Seeding ${rows.length} exchange rows into public.foods for grounding (${exchanges.filter((e) => e.alias).length} with a short-name alias)...`);
  const { error } = await supabase.from("foods").upsert(rows, { onConflict: "source,source_id" });
  if (error) {
    console.error(`foods (exchange rows): failed: ${error.message}`);
    process.exit(1);
  }
}

main();

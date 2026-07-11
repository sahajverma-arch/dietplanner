import type { SupabaseClient } from "@supabase/supabase-js";
import type { DietPlan } from "./nim";

// ---------------------------------------------------------------------------
// Grounds AI-estimated meal macros in the foods reference table (INDB Indian
// recipes + USDA SR Legacy, seeded by scripts/seed-foods.mjs).
//
// Policy: a meal's calories/macros are replaced with database-computed values
// only when EVERY item in the meal matched a food (fuzzy, pg_trgm) AND every
// quantity could be resolved to grams — partially grounded sums would silently
// drop the unmatched items' calories. Unmatched meals keep the model estimate.
// ---------------------------------------------------------------------------

// word_similarity() score below which a match is considered wrong.
const MIN_SIMILARITY = 0.55;
// Sanity bounds — outside these the match/quantity is assumed bad and the
// model estimate is kept.
const MEAL_KCAL_MIN = 20;
const MEAL_KCAL_MAX = 2500;
// A single item above this is a wrong match, a bad quantity, or a source-data
// outlier (a few INDB rows have implausible values) — fall back to AI estimate.
const ITEM_KCAL_MAX = 600;

interface FoodMatch {
  query: string;
  food_id: number;
  name: string;
  source: "INDB" | "USDA";
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  serving_unit: string | null;
  serving_g: number | null;
  similarity: number;
}

export interface GroundingStats {
  total_items: number;
  matched_items: number;
  grounded_meals: number;
  total_meals: number;
  sources: { INDB: number; USDA: number };
}

// Hindi/Indian-English terms mapped to names USDA raw foods are listed under.
// The rewritten query is matched IN ADDITION to the original (INDB names
// already contain Hindi, e.g. "Brinjal bhartha (Baingan ka bhartha)"), and
// whichever variant scores higher wins.
const SYNONYMS: Record<string, string> = {
  bhindi: "okra",
  brinjal: "eggplant",
  baingan: "eggplant",
  aloo: "potato",
  gobi: "cauliflower",
  gobhi: "cauliflower",
  palak: "spinach",
  methi: "fenugreek",
  matar: "green peas",
  pyaaz: "onion",
  tamatar: "tomato",
  dahi: "yogurt",
  curd: "yogurt",
  doodh: "milk",
  paneer: "paneer cheese",
  chawal: "rice",
  atta: "whole wheat flour",
  besan: "chickpea flour",
  suji: "semolina",
  rava: "semolina",
  jaggery: "jaggery sugar",
};

function rewriteQuery(q: string): string | null {
  const words = q.split(/\s+/);
  let changed = false;
  const out = words.map((w) => {
    const mapped = SYNONYMS[w.replace(/[^a-z]/g, "")];
    if (mapped) changed = true;
    return mapped ?? w;
  });
  return changed ? out.join(" ") : null;
}

// ---------------------------------------------------------------------------
// Quantity parsing — "2 rotis", "150 g", "1/2 cup", "1 katori" -> grams
// ---------------------------------------------------------------------------

// Generic Indian household measures in grams (used when the matched food has
// no better serving weight for that unit).
const UNIT_GRAMS: Record<string, number> = {
  katori: 150,
  bowl: 250,
  cup: 200,
  glass: 250,
  plate: 250,
  tbsp: 15,
  tablespoon: 15,
  tsp: 5,
  teaspoon: 5,
  slice: 25,
  scoop: 30,
  handful: 30,
};

const COUNT_UNITS = new Set(["piece", "pc", "no", "unit", "serving", "portion"]);

// Household vessels: when the matched food has its own measured serving
// weight (INDB dishes do), that beats the generic gram map — "1 cup poha"
// means one serving of poha (55 g), not 200 g of it.
const VESSEL_UNITS = new Set(["cup", "bowl", "small bowl", "katori", "plate", "glass", "tea cup"]);

const VULGAR: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };

function parseQuantity(raw: string): { count: number; unit: string } {
  let text = (raw || "").trim().toLowerCase();
  let count = 1;

  for (const [ch, val] of Object.entries(VULGAR)) {
    if (text.includes(ch)) {
      const lead = text.match(/^(\d+)\s*/);
      count = (lead ? parseInt(lead[1]) : 0) + val;
      text = text.replace(/^[\d\s]*/, "").replace(ch, "");
      return { count, unit: normalizeUnit(text) };
    }
  }

  const frac = text.match(/^(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)\s*/);
  if (frac) {
    count = (frac[1] ? parseInt(frac[1]) : 0) + parseInt(frac[2]) / parseInt(frac[3]);
    text = text.slice(frac[0].length);
  } else {
    const num = text.match(/^(\d+(?:\.\d+)?)\s*/);
    if (num) {
      count = parseFloat(num[1]);
      text = text.slice(num[0].length);
    }
  }
  return { count, unit: normalizeUnit(text) };
}

function normalizeUnit(text: string): string {
  return text
    .replace(/^(of|a|an)\s+/, "")
    .trim()
    .replace(/s$/, ""); // crude singular: rotis -> roti, cups -> cup
}

/**
 * Resolves an item quantity to grams, preferring the matched food's own
 * serving weight (e.g. INDB knows one parantha is 56 g) over generic
 * household measures. Returns null when nothing sensible can be derived.
 */
function toGrams(qty: { count: number; unit: string }, food: FoodMatch): number | null {
  const { count, unit } = qty;
  if (!count || count <= 0) return null;

  // Absolute mass/volume units (treat ml as ~1 g/ml for cooked foods/liquids);
  // here the number IS the weight, so only cap at implausible totals.
  if (/^(g|gm|gram|ml)$/.test(unit)) return count <= 2000 ? count : null;
  if (/^(kg|l|litre|liter)$/.test(unit)) return count <= 2 ? count * 1000 : null;

  // Everything below is a count of servings/household measures.
  if (count > 40) return null;

  const servingUnit = (food.serving_unit || "").toLowerCase().replace(/s$/, "");
  const foodName = food.name.toLowerCase();

  // Unit names the food itself (e.g. "2 rotis" for "Roti..."), is a household
  // vessel, or is the food's own serving unit -> use its known serving weight.
  if (
    food.serving_g &&
    (unit === "" ||
      COUNT_UNITS.has(unit) ||
      VESSEL_UNITS.has(unit) ||
      unit === servingUnit ||
      (unit.length >= 3 && (foodName.includes(unit) || servingUnit.includes(unit))))
  ) {
    return count * food.serving_g;
  }

  if (UNIT_GRAMS[unit]) return count * UNIT_GRAMS[unit];

  // Unknown unit ("1 stick", "2 nos") — fall back to the serving weight.
  if (food.serving_g) return count * food.serving_g;
  return null;
}

// ---------------------------------------------------------------------------
// Plan grounding
// ---------------------------------------------------------------------------

const normName = (s: string) => s.trim().toLowerCase();

export async function groundPlan(
  supabase: SupabaseClient,
  plan: DietPlan
): Promise<{ plan: DietPlan; stats: GroundingStats }> {
  const stats: GroundingStats = {
    total_items: 0,
    matched_items: 0,
    grounded_meals: 0,
    total_meals: 0,
    sources: { INDB: 0, USDA: 0 },
  };

  // One round trip: all unique item names + their synonym rewrites.
  const originals = new Set<string>();
  for (const day of plan.days)
    for (const meal of day.meals)
      for (const item of meal.items) originals.add(normName(item.food));

  const queries = new Set<string>(originals);
  originals.forEach((q) => {
    const rw = rewriteQuery(q);
    if (rw) queries.add(rw);
  });
  if (queries.size === 0) return { plan, stats };

  // A full week has 60-100 unique item names; matching each one scans the
  // whole foods table, and one giant statement can exceed Supabase's
  // statement timeout. Chunked parallel calls keep each statement small.
  const CHUNK = 16;
  const list = Array.from(queries);
  const chunks: string[][] = [];
  for (let i = 0; i < list.length; i += CHUNK) chunks.push(list.slice(i, i + CHUNK));

  const results = await Promise.all(
    chunks.map((c) => supabase.rpc("match_foods_batch", { queries: c }))
  );

  const bySimilarity = new Map<string, FoodMatch>();
  for (const { data, error } of results) {
    if (error) throw new Error(`match_foods_batch failed: ${error.message}`);
    for (const row of (data ?? []) as FoodMatch[]) bySimilarity.set(row.query, row);
  }

  const bestFor = (name: string): FoodMatch | null => {
    const orig = bySimilarity.get(name) ?? null;
    const rw = rewriteQuery(name);
    const alt = rw ? bySimilarity.get(rw) ?? null : null;
    const best =
      alt && (!orig || alt.similarity > orig.similarity) ? alt : orig;
    return best && best.similarity >= MIN_SIMILARITY ? best : null;
  };

  const grounded: DietPlan = {
    ...plan,
    days: plan.days.map((day) => {
      const meals = day.meals.map((meal) => {
        stats.total_meals++;
        stats.total_items += meal.items.length;

        let kcal = 0,
          protein = 0,
          carbs = 0,
          fat = 0;
        const mealSources: FoodMatch["source"][] = [];
        let complete = meal.items.length > 0;

        for (const item of meal.items) {
          const match = bestFor(normName(item.food));
          if (!match) {
            complete = false;
            continue;
          }
          stats.matched_items++;
          const grams = toGrams(parseQuantity(item.quantity), match);
          if (grams == null || (match.kcal * grams) / 100 > ITEM_KCAL_MAX) {
            complete = false;
            continue;
          }
          kcal += (match.kcal * grams) / 100;
          protein += (match.protein_g * grams) / 100;
          carbs += (match.carbs_g * grams) / 100;
          fat += (match.fat_g * grams) / 100;
          mealSources.push(match.source);
        }

        if (!complete || kcal < MEAL_KCAL_MIN || kcal > MEAL_KCAL_MAX) return meal;

        stats.grounded_meals++;
        for (const s of mealSources) stats.sources[s]++;
        return {
          ...meal,
          calories: Math.round(kcal),
          protein_g: Math.round(protein),
          carbs_g: Math.round(carbs),
          fat_g: Math.round(fat),
        };
      });

      return {
        ...day,
        meals,
        total_calories: Math.round(meals.reduce((s, m) => s + (m.calories || 0), 0)),
      };
    }),
  };

  return { plan: grounded, stats };
}

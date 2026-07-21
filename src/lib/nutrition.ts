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
// Above MAX the match/quantity is assumed bad and the model estimate is
// kept. There is deliberately NO lower bound for fully-matched meals:
// "herbal tea (1 cup)" really is ~2 kcal, and keeping the model's 300 kcal
// row would print calories for food the meal never lists (dietitian red
// flag). MIN only sets how small a model estimate can be before it stops
// serving as a portion hint for the serving-size retry.
const MEAL_KCAL_MIN = 20;
const MEAL_KCAL_MAX = 2500;
// A single item above this is a wrong match, a bad quantity, or a source-data
// outlier (a few INDB rows have implausible values) — fall back to AI estimate.
const ITEM_KCAL_MAX = 600;
// The model's calorie estimate is only a PORTION HINT, never a result: when
// the grounded total lands this far above it, the model probably priced one
// serving while writing an oversized gram amount, so a serving-size retry
// runs (see groundPlan); MIN_RATIO bounds that retry's acceptance. In every
// other case the database total wins outright — keeping the model's calorie
// level produced fabricated macros dietitians red-flagged in three
// consecutive reviews (76 g-carb besan-chilla dinners on a diabetic plan).
const DIVERGENCE_ABS_KCAL = 150;
const DIVERGENCE_MAX_RATIO = 1.6;
const DIVERGENCE_MIN_RATIO = 0.5;
// A meal whose stated calories disagree with its own macros by more than this
// fraction (against 4/4/9 Atwater) is internally inconsistent; the calories
// are reset to the macro-implied value before any grounding comparison.
const MACRO_KCAL_TOLERANCE = 0.15;

export interface FoodMatch {
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
  "tea cup": 150,
  mug: 300,
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
const VESSEL_UNITS = new Set(["cup", "bowl", "small bowl", "katori", "plate", "glass", "tea cup", "mug"]);

// Volume vessels whose generic gram value assumes dense cooked food (~1 g/ml).
// Light, dry or airy foods weigh a fraction of that per vessel — the main
// source of large grounding over-estimates ("½ cup roasted chana" is ~45 g,
// not 100 g). First matching pattern wins; unlisted foods keep factor 1.
const VOLUME_VESSELS = new Set(["cup", "tea cup", "bowl", "katori", "plate", "glass", "mug"]);
const DENSITY_FACTORS: { pattern: RegExp; factor: number }[] = [
  { pattern: /makhana|foxnut|murmura|puffed|popcorn/i, factor: 0.12 },
  { pattern: /roasted\s+(chana|gram)|chana\s+roasted|namkeen|chivda|mixture|bhel/i, factor: 0.3 },
  { pattern: /cornflakes|flakes|muesli|granola|chips|wafers?/i, factor: 0.35 },
  { pattern: /salad|lettuce|raw\s+greens|coriander|mint\s+leaves/i, factor: 0.35 },
  { pattern: /sprouts?/i, factor: 0.55 },
  { pattern: /almond|cashew|walnut|pistachio|pista|peanut|groundnut|\bnuts?\b|seeds?\b/i, factor: 0.6 },
];

const densityFactor = (text: string): number =>
  DENSITY_FACTORS.find((d) => d.pattern.test(text))?.factor ?? 1;

// "1 small banana", "2 large bowls" — size adjectives scale the weight.
const SIZE_FACTORS: Record<string, number> = { small: 0.8, medium: 1, large: 1.3, big: 1.3 };

// Typical piece weights (g) for countable foods the databases often have no
// serving weight for ("2 rotis" on a USDA match, "4 almonds", "1 apple").
// Deliberately conservative, and always bounded by the divergence guards.
const PIECE_GRAMS: { pattern: RegExp; grams: number }[] = [
  { pattern: /phulka/i, grams: 30 },
  { pattern: /\b(roti|chapati|chappati)\b/i, grams: 40 },
  { pattern: /paratha|parantha/i, grams: 60 },
  { pattern: /\b(puri|poori)\b/i, grams: 25 },
  { pattern: /idli/i, grams: 40 },
  { pattern: /dosa/i, grams: 90 },
  { pattern: /chilla|cheela|pancake/i, grams: 55 },
  { pattern: /\beggs?\b|omelette|omelet/i, grams: 50 },
  { pattern: /biscuits?|cookies?/i, grams: 10 },
  { pattern: /\bdates?\b|khajur/i, grams: 8 },
  { pattern: /almonds?|badam/i, grams: 1.2 },
  { pattern: /cashews?|kaju/i, grams: 1.6 },
  { pattern: /walnut/i, grams: 3 },
  { pattern: /banana/i, grams: 100 },
  { pattern: /apple|pear|orange|mosambi|peach|sweet\s+lime/i, grams: 150 },
  { pattern: /guava|amrud|kiwi|plum|sapota|chikoo/i, grams: 90 },
  { pattern: /mango/i, grams: 200 },
];

// What the client-facing report says each household measure means. Derived
// from UNIT_GRAMS / PIECE_GRAMS so the PDF always states the same weights the
// nutrition math uses — edit those tables, not this list.
const pieceGrams = (name: string) => PIECE_GRAMS.find((p) => p.pattern.test(name))!.grams;
export const PORTION_GUIDE: ReadonlyArray<{ measure: string; weight: string }> = [
  { measure: "1 katori", weight: `${UNIT_GRAMS.katori} g` },
  { measure: "1 bowl", weight: `${UNIT_GRAMS.bowl} g` },
  { measure: "1 plate", weight: `${UNIT_GRAMS.plate} g` },
  { measure: "1 cup", weight: `${UNIT_GRAMS.cup} g` },
  { measure: "1 glass", weight: `${UNIT_GRAMS.glass} ml` },
  { measure: "1 tbsp", weight: `${UNIT_GRAMS.tbsp} g` },
  { measure: "1 tsp", weight: `${UNIT_GRAMS.tsp} g` },
  { measure: "1 handful", weight: `${UNIT_GRAMS.handful} g` },
  { measure: "1 roti", weight: `${pieceGrams("roti")} g` },
  { measure: "1 paratha", weight: `${pieceGrams("paratha")} g` },
];

// Verified protein per everyday portion, fed to the generation prompt so the
// model plans against the same numbers grounding will hold it to. Without it
// the model prices Indian home food at roughly double its real protein (it
// assumes ~9 g for a katori of dal; INDB says 3.8) and every plan lands 40-90 g
// short of its own daily protein target once grounded.
//
// Values are read from the seeded foods table — regenerate with
// `npx tsx scripts/protein-reference.mts` after changing staples.json, and
// paste the output here. Last verified 21 July 2026.
export const PROTEIN_REFERENCE: ReadonlyArray<{ food: string; portion: string; protein_g: number }> = [
  { food: "Roti", portion: "1 roti", protein_g: 2.1 },
  { food: "Dal", portion: "1 katori (150 g)", protein_g: 3.8 },
  { food: "Rice", portion: "1 cup (150 g)", protein_g: 3.9 },
  { food: "Curd", portion: "1 katori (150 g)", protein_g: 5.2 },
  { food: "Milk", portion: "1 glass (200 ml)", protein_g: 6.3 },
  { food: "Rajma / chana masala", portion: "1 katori (150 g)", protein_g: 9.2 },
  { food: "Besan chilla", portion: "2 chilla", protein_g: 8.1 },
  { food: "Roasted chana", portion: "40 g", protein_g: 8.2 },
  { food: "Tofu", portion: "100 g", protein_g: 9 },
  { food: "Eggs", portion: "2 eggs", protein_g: 12.6 },
  { food: "Soya chunks curry", portion: "150 g", protein_g: 15.6 },
  { food: "Chicken curry", portion: "150 g", protein_g: 17.7 },
  { food: "Paneer", portion: "100 g", protein_g: 18.1 },
  { food: "Whey shake", portion: "1 scoop (30 g)", protein_g: 23.4 },
  { food: "Grilled fish", portion: "100 g", protein_g: 26.2 },
  { food: "Grilled chicken", portion: "100 g", protein_g: 31 },
];

const VULGAR: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };

function parseQuantity(raw: string): { count: number; unit: string } {
  let text = (raw || "").trim().toLowerCase();
  // Composite quantities — "2 eggs + 100g curry" — describe the first
  // component; the remainder is preparation detail, not a second amount.
  text = text.split(/\s*\+\s*/)[0];
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
  const cleaned = text.replace(/^(of|a|an)\s+/, "").trim();
  // An absolute unit followed by descriptors — "ml full-fat", "g cooked" —
  // is that unit; the trailing words never change the amount.
  const abs = cleaned.match(/^(g|gm|grams?|ml|kg|l|litres?|liters?)\b/);
  if (abs) return abs[1].replace(/s$/, "");
  return cleaned.replace(/s$/, ""); // crude singular: rotis -> roti, cups -> cup
}

/**
 * Resolves an item quantity to grams, preferring the matched food's own
 * serving weight (e.g. INDB knows one parantha is 56 g) over generic
 * household measures. Generic vessel measures are scaled by the food's
 * density class, size adjectives scale the result, and countable foods fall
 * back to typical piece weights. Returns null when nothing sensible can be
 * derived.
 */
function toGrams(
  qty: { count: number; unit: string },
  food: FoodMatch,
  itemFood: string
): number | null {
  const { count } = qty;
  let { unit } = qty;
  if (!count || count <= 0) return null;

  // Absolute mass/volume units (treat ml as ~1 g/ml for cooked foods/liquids);
  // here the number IS the weight, so only cap at implausible totals.
  if (/^(g|gm|gram|ml)$/.test(unit)) return count <= 2000 ? count : null;
  if (/^(kg|l|litre|liter)$/.test(unit)) return count <= 2 ? count * 1000 : null;

  // Everything below is a count of servings/household measures.
  if (count > 40) return null;

  // "1 small banana", "2 large bowls" — strip the size word, keep its factor.
  let sizeFactor = 1;
  const size = unit.match(/^(small|medium|large|big)\b\s*/);
  if (size) {
    sizeFactor = SIZE_FACTORS[size[1]] ?? 1;
    unit = unit.slice(size[0].length).trim();
  }

  const text = `${itemFood} ${food.name}`.toLowerCase();
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
    return count * food.serving_g * sizeFactor;
  }

  // Generic volume vessels scale by food density; spoons/slices don't.
  if (UNIT_GRAMS[unit]) {
    const density = VOLUME_VESSELS.has(unit) ? densityFactor(text) : 1;
    return count * UNIT_GRAMS[unit] * density * sizeFactor;
  }

  // Counted pieces without a database serving weight ("2 rotis", "4 almonds",
  // "1 apple") — use the typical piece weight.
  if (unit === "" || COUNT_UNITS.has(unit) || (unit.length >= 3 && text.includes(unit))) {
    const piece = PIECE_GRAMS.find((p) => p.pattern.test(text));
    if (piece) return count * piece.grams * sizeFactor;
  }

  // Unknown unit ("1 stick", "2 nos") — fall back to the serving weight.
  if (food.serving_g) return count * food.serving_g * sizeFactor;
  return null;
}

// ---------------------------------------------------------------------------
// Plan grounding
// ---------------------------------------------------------------------------

// "2 rotis", "1 cup oatmeal" — leading counts and measure words are quantity,
// not identity, and sabotage similarity matching ("2 eggs" scored higher
// against "Mayonnaise without eggs" than against the Egg staple).
export function normName(s: string): string {
  const base = s.trim().toLowerCase();
  const stripped = base
    .replace(/^[\d\s./½¼¾⅓⅔x×-]+/, "")
    .replace(/^(cups?|tbsps?|tsps?|glass(?:es)?|bowls?|katoris?|plates?|slices?|pieces?|servings?)\s+(?:of\s+)?/, "")
    .trim();
  return stripped || base;
}

/**
 * Fuzzy-matches food names against the foods table. Each name is queried both
 * as written and through the Hindi-synonym rewrite, and the higher-scoring
 * variant wins; only matches at or above MIN_SIMILARITY are returned. Keyed
 * by normName(name). Shared by plan grounding and the match audit so both
 * always see the same match.
 */
export async function fetchBestMatches(
  supabase: SupabaseClient,
  names: Iterable<string>
): Promise<Map<string, FoodMatch>> {
  const originals = new Set<string>();
  Array.from(names).forEach((n) => {
    const norm = normName(n || "");
    if (norm) originals.add(norm);
  });
  const queries = new Set<string>(originals);
  originals.forEach((q) => {
    const rw = rewriteQuery(q);
    if (rw) queries.add(rw);
  });
  const best = new Map<string, FoodMatch>();
  if (queries.size === 0) return best;

  // A full week has 60-100 unique item names; matching each one scans the
  // whole foods table, and one giant statement can exceed Supabase's
  // statement timeout. Small chunks with capped concurrency keep each
  // statement fast without stampeding the database (an unbounded fan-out
  // times out on corpus-sized audits), and a transient failure gets one
  // retry.
  const CHUNK = 16;
  const CONCURRENCY = 4;
  const list = Array.from(queries);
  const chunks: string[][] = [];
  for (let i = 0; i < list.length; i += CHUNK) chunks.push(list.slice(i, i + CHUNK));

  const runChunk = async (c: string[]) => {
    let res = await supabase.rpc("match_foods_batch", { queries: c });
    if (res.error) res = await supabase.rpc("match_foods_batch", { queries: c });
    return res;
  };

  const bySimilarity = new Map<string, FoodMatch>();
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const group = await Promise.all(chunks.slice(i, i + CONCURRENCY).map(runChunk));
    for (const { data, error } of group) {
      if (error) throw new Error(`match_foods_batch failed: ${error.message}`);
      for (const row of (data ?? []) as FoodMatch[]) bySimilarity.set(row.query, row);
    }
  }

  Array.from(originals).forEach((name) => {
    const orig = bySimilarity.get(name) ?? null;
    const rw = rewriteQuery(name);
    const alt = rw ? bySimilarity.get(rw) ?? null : null;
    const winner = alt && (!orig || alt.similarity > orig.similarity) ? alt : orig;
    if (winner && winner.similarity >= MIN_SIMILARITY) best.set(name, winner);
  });
  return best;
}

type PlanMeal = DietPlan["days"][number]["meals"][number];

// The model sometimes emits a meal whose stated calories disagree with its own
// macros (e.g. 510 kcal stated, 18P/18C/20F = 324 kcal implied). The macros
// are the more granular claim, so the calories are reset to the macro-implied
// value when the two diverge beyond MACRO_KCAL_TOLERANCE.
function reconcileMeal(meal: PlanMeal): PlanMeal {
  const implied = 4 * (meal.protein_g || 0) + 4 * (meal.carbs_g || 0) + 9 * (meal.fat_g || 0);
  if (implied <= 0) return meal;
  const stated = meal.calories || 0;
  if (Math.abs(stated - implied) <= MACRO_KCAL_TOLERANCE * Math.max(stated, implied)) return meal;
  return { ...meal, calories: Math.round(implied) };
}

const divergesFrom = (kcal: number, estimate: number) =>
  Math.abs(kcal - estimate) > DIVERGENCE_ABS_KCAL &&
  (kcal > estimate * DIVERGENCE_MAX_RATIO || kcal < estimate * DIVERGENCE_MIN_RATIO);

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
  const names: string[] = [];
  for (const day of plan.days)
    for (const meal of day.meals)
      for (const item of meal.items) names.push(item.food);
  if (names.length === 0) return { plan, stats };

  const matches = await fetchBestMatches(supabase, names);
  const bestFor = (name: string): FoodMatch | null => matches.get(name) ?? null;

  const grounded: DietPlan = {
    ...plan,
    days: plan.days.map((day) => {
      type Candidate = {
        meal: (typeof day.meals)[number];
        grounded: (typeof day.meals)[number] | null;
        sources: FoodMatch["source"][];
      };
      const candidates: Candidate[] = day.meals.map((rawMeal) => {
        stats.total_meals++;
        stats.total_items += rawMeal.items.length;
        const meal = reconcileMeal(rawMeal);

        let kcal = 0,
          protein = 0,
          carbs = 0,
          fat = 0;
        const mealSources: FoodMatch["source"][] = [];
        let complete = meal.items.length > 0;
        const resolved: { idx: number; match: FoodMatch; grams: number }[] = [];

        for (let i = 0; i < meal.items.length; i++) {
          const item = meal.items[i];
          const match = bestFor(normName(item.food));
          if (!match) {
            complete = false;
            continue;
          }
          stats.matched_items++;
          const grams = toGrams(parseQuantity(item.quantity), match, item.food);
          if (grams == null || (match.kcal * grams) / 100 > ITEM_KCAL_MAX) {
            complete = false;
            continue;
          }
          resolved.push({ idx: i, match, grams });
          kcal += (match.kcal * grams) / 100;
          protein += (match.protein_g * grams) / 100;
          carbs += (match.carbs_g * grams) / 100;
          fat += (match.fat_g * grams) / 100;
          mealSources.push(match.source);
        }

        if (!complete || kcal > MEAL_KCAL_MAX) {
          // A meal the model left with no calorie estimate (the schema
          // defaults an omitted "calories" to 0) must never ship at 0 while
          // it lists real food. If at least one item grounded, use that
          // partial database sum: it understates (unmatched items are
          // dropped), but every printed number is a real DB value — strictly
          // better than a 0-kcal meal the client can't act on. Meals that
          // DID carry a model estimate keep the existing behaviour.
          const noEstimate = (meal.calories || 0) <= 0;
          if (noEstimate && resolved.length > 0 && kcal > 0 && kcal <= MEAL_KCAL_MAX) {
            return {
              meal,
              grounded: {
                ...meal,
                calories: Math.round(kcal),
                protein_g: Math.round(protein),
                carbs_g: Math.round(carbs),
                fat_g: Math.round(fat),
              },
              sources: mealSources,
            };
          }
          return { meal, grounded: null, sources: [] };
        }

        // Grounded far ABOVE the estimate usually means the model wrote a
        // gram amount several times the food's real serving ("poha (150 g)"
        // priced as a 150 kcal snack — a bowl is 55 g). Retry oversized
        // items at one serving; if that lands near the estimate, that's the
        // portion the model actually priced — use it and correct the
        // printed quantity so the PDF agrees with its own numbers. In every
        // other case the database total below wins outright.
        const estimate = meal.calories || 0;
        if (
          estimate >= MEAL_KCAL_MIN &&
          kcal - estimate > DIVERGENCE_ABS_KCAL &&
          kcal > estimate * DIVERGENCE_MAX_RATIO
        ) {
          const retried = resolved.map((r) =>
            r.match.serving_g && r.grams > 2 * r.match.serving_g
              ? { ...r, grams: r.match.serving_g, shrunk: true }
              : { ...r, shrunk: false }
          );
          if (retried.some((r) => r.shrunk)) {
            const sum = retried.reduce(
              (a, r) => ({
                kcal: a.kcal + (r.match.kcal * r.grams) / 100,
                p: a.p + (r.match.protein_g * r.grams) / 100,
                c: a.c + (r.match.carbs_g * r.grams) / 100,
                f: a.f + (r.match.fat_g * r.grams) / 100,
              }),
              { kcal: 0, p: 0, c: 0, f: 0 }
            );
            if (sum.kcal >= MEAL_KCAL_MIN && !divergesFrom(sum.kcal, estimate)) {
              const items = meal.items.map((item, i) => {
                const r = retried.find((x) => x.idx === i);
                if (!r || !r.shrunk) return item;
                const unit = r.match.serving_unit ? ` (1 ${r.match.serving_unit})` : "";
                return { ...item, quantity: `~${Math.round(r.grams)} g${unit}` };
              });
              return {
                meal,
                grounded: {
                  ...meal,
                  items,
                  calories: Math.round(sum.kcal),
                  protein_g: Math.round(sum.p),
                  carbs_g: Math.round(sum.c),
                  fat_g: Math.round(sum.f),
                },
                sources: mealSources,
              };
            }
          }
        }

        return {
          meal,
          grounded: {
            ...meal,
            calories: Math.round(kcal),
            protein_g: Math.round(protein),
            carbs_g: Math.round(carbs),
            fat_g: Math.round(fat),
          },
          sources: mealSources,
        };
      });

      // Grounded meals are always kept — hiding an under-portioned day behind
      // the model's invented rows misled dietitians twice. A day landing far
      // under its calorie target is real information, surfaced to the
      // nutrition top-up pass and the draft preview instead of masked here.
      const meals = candidates.map((c) => c.grounded ?? c.meal);
      for (const c of candidates)
        if (c.grounded) {
          stats.grounded_meals++;
          for (const s of c.sources) stats.sources[s]++;
        }

      return {
        ...day,
        meals,
        total_calories: Math.round(meals.reduce((s, m) => s + (m.calories || 0), 0)),
      };
    }),
  };

  return { plan: grounded, stats };
}

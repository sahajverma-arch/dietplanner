import type { SupabaseClient } from "@supabase/supabase-js";
import type { DietPlan } from "./nim";
import { fetchBestMatches, normName, type FoodMatch } from "./nutrition";

// ---------------------------------------------------------------------------
// Match audit — re-checks every item name a plan sends to the foods table and
// flags the matches a dietitian would call wrong, before the draft reaches
// review. Catches the failure modes seen in live reviews:
//   - "peanut butter"   -> Peanut butter cucumber sandwich (fat-poor match
//                          for a fat-dense food; reported 4 g fat for 2 tbsp)
//   - "chicken biryani" -> Afghani chicken (carb-free match for a rice dish;
//                          reported 17 g carbs for a biryani lunch)
//   - "jeera rice"      -> Jal jeera (a drink matched for a grain dish)
//   - unmatched names, whose meals silently keep unverified AI estimates
//
// Heuristics are composition-based: a food-class keyword in the QUERY implies
// a macro profile the MATCHED row must roughly satisfy per 100 g. Thresholds
// are deliberately loose — cooked dal really is only ~2.5 g protein/100 g —
// so a flag means "a dietitian should look", not "certainly wrong".
// ---------------------------------------------------------------------------

export interface MatchFinding {
  query: string;
  matchedName: string | null;
  source: "INDB" | "USDA" | null;
  similarity: number | null;
  verdict: "suspect" | "unmatched" | "weak" | "ok";
  reason: string;
}

// Below this, a fuzzy (non-staple) match is worth a human glance. Exact
// staple hits score ~1.3 from the blended ranking.
const CONFIDENT_SIMILARITY = 0.75;

const FOOD_CLASSES: {
  pattern: RegExp;
  expect: string;
  bad: (m: FoodMatch) => string | null;
}[] = [
  {
    pattern:
      /biryani|pulao|\brice\b|khichdi|poha|upma|noodles?|pasta|idli|dosa|paratha|roti|chapati|bread|toast|daliya|oats/i,
    expect: "grain dish",
    bad: (m) => (m.carbs_g < 10 ? `only ${m.carbs_g} g carbs/100g` : null),
  },
  {
    pattern:
      /paneer|chicken|mutton|keema|\beggs?\b|soya|tofu|\bdal\b|sprouts?|chana|rajma|chole|\bcurd\b|yogurt/i,
    expect: "protein food",
    bad: (m) => (m.protein_g < 2 ? `only ${m.protein_g} g protein/100g` : null),
  },
  {
    pattern: /butter|ghee|\boils?\b|almonds?|cashews?|walnuts?|peanuts?|\bseeds?\b|mayonnaise/i,
    expect: "fat-dense food",
    bad: (m) => (m.fat_g < 15 ? `only ${m.fat_g} g fat/100g` : null),
  },
  {
    pattern: /\btea\b|coffee|\bwater\b|juice|chaas|buttermilk|lassi|\bmilk\b/i,
    expect: "beverage",
    bad: (m) => (m.kcal > 150 ? `${m.kcal} kcal/100g is too dense` : null),
  },
];

const SEVERITY: Record<MatchFinding["verdict"], number> = {
  suspect: 0,
  unmatched: 1,
  weak: 2,
  ok: 3,
};

/** Audit a set of raw item names. One finding per unique (normalized) name. */
export async function auditItems(
  supabase: SupabaseClient,
  rawNames: Iterable<string>
): Promise<MatchFinding[]> {
  const unique = new Map<string, string>(); // normalized -> first raw spelling
  Array.from(rawNames).forEach((raw) => {
    const norm = normName(raw || "");
    if (norm && !unique.has(norm)) unique.set(norm, raw.trim());
  });
  const matches = await fetchBestMatches(supabase, Array.from(unique.keys()));

  const findings: MatchFinding[] = [];
  for (const [norm, raw] of Array.from(unique.entries())) {
    const m = matches.get(norm) ?? null;
    if (!m) {
      findings.push({
        query: raw,
        matchedName: null,
        source: null,
        similarity: null,
        verdict: "unmatched",
        reason: "no database food matches — meals with this item keep unverified AI estimates",
      });
      continue;
    }

    let failure: string | null = null;
    let expect = "";
    for (const cls of FOOD_CLASSES) {
      if (!cls.pattern.test(norm)) continue;
      failure = cls.bad(m);
      if (failure) {
        expect = cls.expect;
        break;
      }
    }

    if (failure) {
      findings.push({
        query: raw,
        matchedName: m.name,
        source: m.source,
        similarity: m.similarity,
        verdict: "suspect",
        reason: `matched "${m.name}" but ${failure} — implausible for a ${expect}`,
      });
    } else if (m.similarity < CONFIDENT_SIMILARITY) {
      findings.push({
        query: raw,
        matchedName: m.name,
        source: m.source,
        similarity: m.similarity,
        verdict: "weak",
        reason: `low-confidence fuzzy match (similarity ${m.similarity.toFixed(2)}) — verify "${m.name}" really is "${raw}"`,
      });
    } else {
      findings.push({
        query: raw,
        matchedName: m.name,
        source: m.source,
        similarity: m.similarity,
        verdict: "ok",
        reason: "",
      });
    }
  }
  return findings.sort((a, b) => SEVERITY[a.verdict] - SEVERITY[b.verdict]);
}

/** Audit every item in a plan. */
export async function auditPlan(
  supabase: SupabaseClient,
  plan: DietPlan
): Promise<MatchFinding[]> {
  const names: string[] = [];
  for (const day of plan.days)
    for (const meal of day.meals) for (const item of meal.items) names.push(item.food);
  return auditItems(supabase, names);
}

// Applies the client's regional food vocabulary (public.regional_food_terms,
// migration 0015) to a plan's item names — "Fulka (Roti)", "Thayir (Curd)" —
// so the PDF a client actually receives speaks their household's own diet
// syntax, not just the North Indian/Hindi default every plan is generated in.
//
// DISPLAY-ONLY, and applied only at PDF render time (see the "approve" step
// in /api/generate-plan), never to the stored draft: grounding matches every
// item against its plain English canonical name, and a dietitian's "revise"
// round re-reads that same stored draft. Renaming the stored plan would
// silently break both. Only rows with confidence='confirmed' are used —
// 'partial' rows carry a caveat a person hasn't cleared yet, and
// 'unconfirmed' rows have no term at all (see the migration's own comment).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DietPlan } from "./nim";

const wordsOf = (s: string): string[] =>
  s.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);

/**
 * True when `bucketWords` sits at the very start or very end of `nameWords` —
 * "dal" matches "Moong dal" (suffix) and "Roti" matches "Roti" (whole name),
 * but NOT "Chapati with dal and carrot", where "dal" is buried inside a
 * conjunction describing a different dish entirely. A bucket word appearing
 * only in the middle of a longer description is not that item's identity.
 */
const matchesAsEdge = (nameWords: string[], bucketWords: string[]): boolean => {
  if (bucketWords.length === 0 || bucketWords.length > nameWords.length) return false;
  const bucket = bucketWords.join(" ");
  return (
    nameWords.slice(0, bucketWords.length).join(" ") === bucket ||
    nameWords.slice(-bucketWords.length).join(" ") === bucket
  );
};

/** canonical_food (lowercased) -> regional_term, for one region's confirmed rows. */
export async function fetchConfirmedRegionalTerms(
  supabase: SupabaseClient,
  region: string
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("regional_food_terms")
    .select("canonical_food, regional_term")
    .eq("region", region)
    .eq("confidence", "confirmed")
    .not("regional_term", "is", null)
    .not("canonical_food", "is", null);
  if (error || !data) return new Map();
  return new Map(
    data
      .filter((r): r is { canonical_food: string; regional_term: string } => !!r.canonical_food && !!r.regional_term)
      .map((r) => [r.canonical_food.toLowerCase(), r.regional_term])
  );
}

/**
 * "Roti" -> "Fulka (Roti)" when a recognised canonical food sits at the start
 * or end of the name (matchesAsEdge) — never when it's only mentioned inside
 * a longer description ("Chapati with dal and carrot" is a chapati, not a
 * dal, even though the word "dal" appears in it). Matching exactly one bucket
 * at an edge renames it; one bucket that strictly contains another matched
 * bucket wins as a refinement ("Fish curry" over "Fish" in "Rohu fish
 * curry"); two matches where neither contains the other (e.g. "Curd rice"
 * matching both "curd" and "rice" at its two edges) are genuinely ambiguous
 * and the name is left unchanged rather than guessed — same caution as
 * identityConflict() in nutrition.ts: a wrong guess is worse than no rename.
 */
export function regionalizeFoodName(name: string, glossary: Map<string, string>): string {
  if (glossary.size === 0) return name;
  const nameWords = wordsOf(name);
  const matches: { canonical: string; term: string }[] = [];
  glossary.forEach((term, canonical) => {
    if (matchesAsEdge(nameWords, wordsOf(canonical))) matches.push({ canonical, term });
  });
  if (matches.length === 0) return name;
  if (matches.length === 1) return `${matches[0].term} (${name})`;

  matches.sort((a, b) => b.canonical.length - a.canonical.length);
  const [longest, ...rest] = matches;
  const isRefinement = rest.every((m) => longest.canonical.toLowerCase().includes(m.canonical.toLowerCase()));
  return isRefinement ? `${longest.term} (${name})` : name;
}

/** New plan with regional names applied to every item — never mutates `plan`, never touches macros/quantities. */
export function applyRegionalNames(plan: DietPlan, glossary: Map<string, string>): DietPlan {
  if (glossary.size === 0) return plan;
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      meals: day.meals.map((meal) => ({
        ...meal,
        items: meal.items.map((item) => ({ ...item, food: regionalizeFoodName(item.food, glossary) })),
      })),
    })),
  };
}

/**
 * Renames `plan`'s items using the first of the client's cuisines (q34 allows
 * up to 3) that actually has confirmed terms. Entries like "North Indian" or
 * "Indian mixed" intentionally have none (see migration 0015) and are skipped
 * in favour of a more specific cuisine when the client gave one. Returns
 * `plan` unchanged if nothing usable is found.
 */
export async function regionalizePlan(
  supabase: SupabaseClient,
  plan: DietPlan,
  cuisines: string[]
): Promise<DietPlan> {
  for (const cuisine of cuisines) {
    const glossary = await fetchConfirmedRegionalTerms(supabase, cuisine);
    if (glossary.size > 0) return applyRegionalNames(plan, glossary);
  }
  return plan;
}

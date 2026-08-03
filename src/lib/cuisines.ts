/**
 * Canonical cuisine/region vocabulary for `foods.cuisine_tags`.
 *
 * Mirrors the `q34` ("What cuisine does your household normally follow?")
 * options in src/lib/counselling/questions.ts exactly, minus the freeform
 * "Other" escape hatch, so a client's intake answer can be compared against
 * a food's tags with a plain SQL array overlap (`&&`) — no translation layer.
 * "Pan-Indian" is the one addition: a catch-all for staples (dal, rice, roti,
 * curd) that aren't tied to a single region. If q34's options change, update
 * this list to match.
 */
export const CUISINE_TAGS = [
  "North Indian",
  "Punjabi",
  "Gujarati",
  "Rajasthani",
  "Maharashtrian",
  "Bengali",
  "Bihari or Jharkhand",
  "South Indian",
  "Kerala-style",
  "Tamil",
  "Telugu",
  "Karnataka",
  "North-East Indian",
  "Kashmiri",
  "Indian mixed",
  "Middle Eastern",
  "Mediterranean",
  "East Asian",
  "South-East Asian",
  "European or Western",
  "African",
  "Latin American",
  "Mixed or international",
  "Pan-Indian",
] as const;

export type CuisineTag = (typeof CUISINE_TAGS)[number];

const CUISINE_TAG_SET: ReadonlySet<string> = new Set(CUISINE_TAGS);

export function isCuisineTag(value: string): value is CuisineTag {
  return CUISINE_TAG_SET.has(value);
}

/** Splits an intake's comma-joined `cuisines` string back into a list. */
export function parseCuisines(cuisines: string | undefined | null): string[] {
  if (!cuisines) return [];
  return cuisines
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

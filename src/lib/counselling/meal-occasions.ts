// The eating occasions the food-day recall (Q24/Q28) is broken into.
//
// Its own module because two things need it and they cannot import each other:
// questions.ts builds the `q28_<key>_*` question rows from it, and
// protein-intake.ts reads those same rows back to count the protein in staples
// like roti and rice. When this list lived in questions.ts, protein-intake.ts
// kept a hardcoded copy of the keys — and the v3.0 rewrite added five occasions
// to one copy and not the other, so food recorded under "Snacks" was silently
// worth zero protein. One list, no drift.
//
// The `key` is a storage key and must never be renamed; labels can change
// freely. "beforesleep" in particular is relied on by the bedtime projection in
// assessment.ts even though v3.0 renamed its label to "Late-Night Food".
export const MEAL_OCCASIONS: { key: string; label: string }[] = [
  { key: "wake", label: "Wake-up Drinks" },
  { key: "breakfast", label: "Breakfast" },
  { key: "midmorning", label: "Mid-Morning" },
  { key: "lunch", label: "Lunch" },
  { key: "afternoon", label: "Afternoon" },
  { key: "evening", label: "Evening" },
  { key: "preworkout", label: "Pre-Workout" },
  { key: "duringworkout", label: "During Workout" },
  { key: "postworkout", label: "Post-Workout" },
  { key: "dinner", label: "Dinner" },
  { key: "afterdinner", label: "After Dinner" },
  { key: "beforesleep", label: "Late-Night Food" },
  { key: "beverages", label: "Beverages" },
  { key: "snacks", label: "Snacks" },
  { key: "tasting", label: "Tasting While Cooking" },
  { key: "smallbites", label: "Small Bites" },
  { key: "alcohol", label: "Alcohol" },
];

/** Every occasion key, for anything that scans the whole recorded food day. */
export const MEAL_KEYS = MEAL_OCCASIONS.map((m) => m.key);

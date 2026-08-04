// Type-only import, and the two answer helpers are re-declared below rather
// than imported: questions.ts imports the food table from this module to build
// its per-food questions, so a value import in this direction would create a
// runtime import cycle.
import type { Answers } from "./counselling/questions";
import { variantIntake, type VariantIntake } from "./counselling/meal-variants";
// Value import is safe: meal-occasions.ts imports nothing, so no cycle.
import { MEAL_KEYS } from "./counselling/meal-occasions";

const val = (a: Answers, id: string): string => {
  const v = a[id];
  return typeof v === "string" ? v : "";
};
const list = (a: Answers, id: string): string[] => {
  const v = a[id];
  return Array.isArray(v) ? v : [];
};

// ---------------------------------------------------------------------------
// Measured current protein intake, and the week-1 protein target it implies.
//
// Replaces a judgement call (q92 "Current protein assessment: Very low / Low /
// Moderate…") with a number: for every protein food the client actually eats,
// counselling records how often and how much, and each is priced from the same
// foods table that grounds the finished plan. The target is then the client's
// measured intake raised 10-15% — a progression they can actually sustain —
// instead of a figure the model picks for itself (measured drifting 80 -> 62 g
// and 140 -> 125 g across generation runs, always downward once plans got hard
// to hit).
//
// Every gram here is therefore an estimate of what the client ALREADY eats. It
// is only as good as the frequency and portion the dietitian records, which is
// why the counselling form shows the running total during the session.
// ---------------------------------------------------------------------------

/** Diet classes used to decide which foods are offered for a food pattern. */
type FoodClass = "plant" | "dairy" | "egg" | "fish" | "meat";

export interface ProteinFood {
  /** Stable key — forms the counselling question ids, so never renumber. */
  id: string;
  /** Must match the q50 option text exactly; that is how selection is read. */
  label: string;
  /** Standard household portion this food is counted in. */
  portion: string;
  /** Protein in one standard portion, from the foods table. */
  proteinPerPortion: number;
  /** Carbohydrate in that same portion, from the same database row. */
  carbsPerPortion: number;
  /** Fat in that same portion, from the same database row. */
  fatPerPortion: number;
  /** Energy in that same portion, from the same database row. */
  kcalPerPortion: number;
  klass: FoodClass;
}

// Protein, carbs, fat and energy per standard portion, read from the seeded
// foods table — regenerate with `npx tsx scripts/intake-reference.mts` after
// changing staples.json and paste the output here. Last verified 22 July 2026.
//
// Carbs and fat are DESCRIPTIVE only: they show the dietitian what the client
// currently eats. Nothing downstream targets them — the week-1 target this
// module produces is still protein, and the plan's carb/fat split is derived
// from calories and that protein target, not from these numbers.
//
// Portions are the everyday Indian serving a dietitian would picture, and the
// curry forms are used for chicken/fish/mutton deliberately: home eating is
// curry, not a grilled fillet, and pricing 150 g of chicken curry (17.7 g) as
// 150 g of grilled breast (46 g) would inflate every non-vegetarian estimate.
export const PROTEIN_FOODS: ProteinFood[] = [
  { id: "milk", label: "Milk", portion: "1 glass (200 ml)", proteinPerPortion: 6.3, carbsPerPortion: 9.6, fatPerPortion: 6.5, kcalPerPortion: 122, klass: "dairy" },
  { id: "curd", label: "Curd", portion: "1 katori (150 g)", proteinPerPortion: 5.2, carbsPerPortion: 7, fatPerPortion: 4.9, kcalPerPortion: 92, klass: "dairy" },
  { id: "greek", label: "Greek or high-protein yogurt", portion: "1 cup (170 g)", proteinPerPortion: 17.3, carbsPerPortion: 6.1, fatPerPortion: 0.7, kcalPerPortion: 100, klass: "dairy" },
  { id: "buttermilk", label: "Buttermilk or chaas", portion: "1 glass (250 ml)", proteinPerPortion: 3.4, carbsPerPortion: 4.7, fatPerPortion: 1.8, kcalPerPortion: 47, klass: "dairy" },
  { id: "paneer", label: "Paneer", portion: "100 g", proteinPerPortion: 18.1, carbsPerPortion: 3, fatPerPortion: 23.8, kcalPerPortion: 299, klass: "dairy" },
  { id: "tofu", label: "Tofu", portion: "100 g", proteinPerPortion: 9, carbsPerPortion: 2.9, fatPerPortion: 4.2, kcalPerPortion: 78, klass: "plant" },
  { id: "soy", label: "Soy chunks", portion: "1 katori curry (150 g)", proteinPerPortion: 15.6, carbsPerPortion: 10.1, fatPerPortion: 15.3, kcalPerPortion: 245, klass: "plant" },
  { id: "tempeh", label: "Tempeh", portion: "100 g", proteinPerPortion: 20.3, carbsPerPortion: 7.6, fatPerPortion: 10.8, kcalPerPortion: 192, klass: "plant" },
  { id: "dal", label: "Dal", portion: "1 katori (150 g)", proteinPerPortion: 3.8, carbsPerPortion: 8.7, fatPerPortion: 4.7, kcalPerPortion: 93, klass: "plant" },
  { id: "chole", label: "Chickpeas or chole", portion: "1 katori (150 g)", proteinPerPortion: 9.2, carbsPerPortion: 30, fatPerPortion: 10.3, kcalPerPortion: 245, klass: "plant" },
  { id: "rajma", label: "Rajma or beans", portion: "1 katori (150 g)", proteinPerPortion: 8.9, carbsPerPortion: 24.6, fatPerPortion: 8.7, kcalPerPortion: 216, klass: "plant" },
  { id: "sprouts", label: "Sprouts", portion: "1 cup (100 g)", proteinPerPortion: 3, carbsPerPortion: 5.9, fatPerPortion: 0.2, kcalPerPortion: 30, klass: "plant" },
  { id: "chana", label: "Roasted chana", portion: "1 handful (40 g)", proteinPerPortion: 8.2, carbsPerPortion: 25.2, fatPerPortion: 2.4, kcalPerPortion: 151, klass: "plant" },
  { id: "nuts", label: "Nuts or seeds", portion: "1 handful (30 g)", proteinPerPortion: 7.7, carbsPerPortion: 4.8, fatPerPortion: 14.8, kcalPerPortion: 170, klass: "plant" },
  { id: "powder", label: "Protein powder", portion: "1 scoop (30 g)", proteinPerPortion: 23.4, carbsPerPortion: 1.9, fatPerPortion: 0.5, kcalPerPortion: 106, klass: "plant" },
  { id: "eggs", label: "Eggs", portion: "2 eggs", proteinPerPortion: 12.6, carbsPerPortion: 1.1, fatPerPortion: 10.6, kcalPerPortion: 155, klass: "egg" },
  { id: "fish", label: "Fish", portion: "1 katori curry (150 g)", proteinPerPortion: 13.1, carbsPerPortion: 5.7, fatPerPortion: 10, kcalPerPortion: 167, klass: "fish" },
  { id: "seafood", label: "Seafood", portion: "1 katori curry (150 g)", proteinPerPortion: 12.8, carbsPerPortion: 4.7, fatPerPortion: 10.4, kcalPerPortion: 164, klass: "fish" },
  { id: "chicken", label: "Chicken", portion: "1 katori curry (150 g)", proteinPerPortion: 17.7, carbsPerPortion: 5.1, fatPerPortion: 11.4, kcalPerPortion: 194, klass: "meat" },
  { id: "meat", label: "Meat", portion: "1 katori curry (150 g)", proteinPerPortion: 10.6, carbsPerPortion: 3.8, fatPerPortion: 12.8, kcalPerPortion: 173, klass: "meat" },
];

// Which food classes each q33 food pattern may be offered. A dietitian can
// still record anything they select in q50; this only decides what the form
// puts in front of them, so a vegetarian consultation is not a wall of
// chicken and fish rows.
const PATTERN_CLASSES: Record<string, FoodClass[]> = {
  Vegetarian: ["plant", "dairy"],
  Jain: ["plant", "dairy"],
  Vegan: ["plant"],
  Eggetarian: ["plant", "dairy", "egg"],
  Pescatarian: ["plant", "dairy", "egg", "fish"],
  "Non-vegetarian": ["plant", "dairy", "egg", "fish", "meat"],
  Flexitarian: ["plant", "dairy", "egg", "fish", "meat"],
};
const ALL_CLASSES: FoodClass[] = ["plant", "dairy", "egg", "fish", "meat"];

/**
 * Foods offered for the recorded food pattern.
 *
 * Returns NOTHING until Q33 is answered: offering the full list first means a
 * dietitian can record chicken for a vegetarian without ever being asked, and
 * an unfiltered list looks identical to a non-vegetarian one, so the filter
 * appears not to work. An unrecognised pattern ("Other") still gets everything
 * — the dietitian has told us they know, we just cannot classify it.
 */
export function foodsForPattern(a: Answers): ProteinFood[] {
  const pattern = val(a, "q33");
  if (!pattern.trim()) return [];
  const allowed = PATTERN_CLASSES[pattern] ?? ALL_CLASSES;
  return PROTEIN_FOODS.filter((f) => allowed.includes(f.klass));
}

// How often, as times per week. Coarse on purpose — a dietitian asking "how
// many days a week?" gets a band, not a decimal, and false precision here
// would not survive contact with a real consultation.
export const FREQUENCY_OPTIONS: { label: string; perWeek: number }[] = [
  { label: "Daily", perWeek: 7 },
  { label: "5–6 days a week", perWeek: 5.5 },
  { label: "3–4 days a week", perWeek: 3.5 },
  { label: "1–2 days a week", perWeek: 1.5 },
  { label: "Less than once a week", perWeek: 0.5 },
  { label: "Never", perWeek: 0 },
];

// Portion relative to the standard one above. Left unanswered it counts as one
// standard portion, so the dietitian only touches this when it differs.
export const PORTION_OPTIONS: { label: string; multiplier: number }[] = [
  { label: "Half portion", multiplier: 0.5 },
  { label: "1 standard portion", multiplier: 1 },
  { label: "1½ portions", multiplier: 1.5 },
  { label: "2 portions", multiplier: 2 },
  { label: "3 or more portions", multiplier: 3 },
];

export const freqQuestionId = (id: string) => `q50p_${id}_freq`;
export const portionQuestionId = (id: string) => `q50p_${id}_portion`;

// ---------------------------------------------------------------------------
// Staple baseline
// ---------------------------------------------------------------------------

// Protein from foods that are NOT protein foods, so they never appear in Q50
// and were being counted as zero. Four rotis carry more protein than a katori
// of dal, and leaving them out halved every estimate: one client measured at
// 17 g/day when her own recorded food day came to about 31 g, which then set a
// week-1 target of 19 g against a real requirement near 60.
//
// Read from the same foods table as PROTEIN_REFERENCE (regenerate alongside
// it). Nothing here may duplicate a PROTEIN_FOODS label, or Q50 and the Q28
// food day would both count it.
// Regenerated alongside PROTEIN_FOODS by `npx tsx scripts/intake-reference.mts`.
// The staples are where the client's carbohydrate actually lives — roti, rice
// and dosa carry the bulk of it — so leaving them out of the carb estimate
// would understate it far more severely than it understated protein.
const STAPLE_PROTEIN: {
  pattern: RegExp;
  label: string;
  perUnit: number;
  carbsPerUnit: number;
  fatPerUnit: number;
  kcalPerUnit: number;
  defaultUnits: number;
}[] = [
  { pattern: /\b(rotis?|chapatis?|chappatis?|phulkas?)\b/i, label: "Roti", perUnit: 2.1, carbsPerUnit: 12.8, fatPerUnit: 1.3, kcalPerUnit: 73, defaultUnits: 2 },
  { pattern: /\b(parathas?|paranthas?)\b/i, label: "Paratha", perUnit: 4.1, carbsPerUnit: 18, fatPerUnit: 7.8, kcalPerUnit: 161, defaultUnits: 1 },
  { pattern: /\b(rice|chawal|pulao|biryani)\b/i, label: "Rice", perUnit: 3.9, carbsPerUnit: 38.6, fatPerUnit: 0.3, kcalPerUnit: 176, defaultUnits: 1 },
  { pattern: /\bpoha\b/i, label: "Poha", perUnit: 4.9, carbsPerUnit: 21.5, fatPerUnit: 8.1, kcalPerUnit: 181, defaultUnits: 1 },
  { pattern: /\b(bread|toast)\b/i, label: "Bread", perUnit: 3.1, carbsPerUnit: 10.7, fatPerUnit: 0.9, kcalPerUnit: 63, defaultUnits: 2 },
  { pattern: /\bidli/i, label: "Idli", perUnit: 1.9, carbsPerUnit: 11.3, fatPerUnit: 0.1, kcalPerUnit: 55, defaultUnits: 2 },
  { pattern: /\bdosa/i, label: "Dosa", perUnit: 9.3, carbsPerUnit: 57.7, fatPerUnit: 7.6, kcalPerUnit: 343, defaultUnits: 1 },
  { pattern: /\b(upma|daliya|dalia)\b/i, label: "Upma", perUnit: 3.9, carbsPerUnit: 26.9, fatPerUnit: 11.2, kcalPerUnit: 227, defaultUnits: 1 },
  { pattern: /\bkhichdi\b/i, label: "Khichdi", perUnit: 2.6, carbsPerUnit: 15.1, fatPerUnit: 1.5, kcalPerUnit: 86, defaultUnits: 1 },
  { pattern: /\b(chilla|cheela)\b/i, label: "Chilla", perUnit: 4.1, carbsPerUnit: 10.9, fatPerUnit: 1.5, kcalPerUnit: 71, defaultUnits: 2 },
  { pattern: /\b(sabzi|sabji|subzi|vegetables?)\b/i, label: "Sabzi", perUnit: 4.2, carbsPerUnit: 10.8, fatPerUnit: 7, kcalPerUnit: 125, defaultUnits: 1 },
  { pattern: /\bsalad\b/i, label: "Salad", perUnit: 1.2, carbsPerUnit: 3.3, fatPerUnit: 0.3, kcalPerUnit: 17, defaultUnits: 1 },
  { pattern: /\b(biscuits?|cookies?)\b/i, label: "Biscuits", perUnit: 0.4, carbsPerUnit: 5.5, fatPerUnit: 1.9, kcalPerUnit: 40, defaultUnits: 2 },
  { pattern: /\b(banana|apple|guava|orange|papaya|pear|fruit)\b/i, label: "Fruit", perUnit: 1.1, carbsPerUnit: 22.8, fatPerUnit: 0.3, kcalPerUnit: 89, defaultUnits: 1 },
];


export interface StapleContribution {
  label: string;
  units: number;
  /** Protein per day, kept as `gramsPerDay` so existing callers still read. */
  gramsPerDay: number;
  carbsPerDay: number;
  fatPerDay: number;
  kcalPerDay: number;
}

// ---------------------------------------------------------------------------
// Structured staple picks
//
// The free-text food day is the original input and still works, but a
// dietitian mid-consultation should not have to type "2 rotis + dal 1 katori"
// for seventeen occasions — and when they type something the parser cannot
// match ("lunch: home food", "chawal-sabzi"), every staple silently counts as
// zero, which is what makes an intake read as 22% carbs. The picker records
// the same thing as taps: a staple and a count.
//
// Stored as a string[] per occasion ("Roti × 2") because Answers is
// Record<string, string | string[]> and must stay that way — every saved draft
// in the database is already that shape.
// ---------------------------------------------------------------------------

/** The staples offered by the picker. Never includes a PROTEIN_FOODS label. */
export const STAPLE_LABELS: string[] = STAPLE_PROTEIN.map((s) => s.label);

export const stapleQuestionId = (mealKey: string) => `q28_${mealKey}_staples`;

export const encodeStaplePick = (label: string, units: number) => `${label} × ${units}`;

/** Parses "Roti × 2" back to its parts; null for anything unrecognised. */
export function decodeStaplePick(entry: string): { label: string; units: number } | null {
  const m = entry.match(/^(.+?)\s*[×x]\s*(\d+(?:\.\d+)?)$/i);
  if (!m) return null;
  const label = m[1].trim();
  // Staples and drinks share the encoding, and therefore the whitelist — the
  // list is what stops a stray "note x 3" being parsed as food.
  if (!STAPLE_LABELS.includes(label) && !BEVERAGE_LABELS.includes(label)) return null;
  const units = parseFloat(m[2]);
  return Number.isFinite(units) && units > 0 ? { label, units } : null;
}

/**
 * Protein per day from the staples in the client's recorded Q28 food day.
 *
 * The text is free-form ("2 rotis + dal 1 katori + sabzi"), so each component
 * is split on separators and matched against one staple; the count is whatever
 * number sits in that component, else a typical serving. Rough by nature — but
 * counting four rotis as roughly four rotis is far closer than counting them
 * as zero.
 */
export function stapleProtein(a: Answers): StapleContribution[] {
  const totals = new Map<
    string,
    { units: number; grams: number; carbs: number; fat: number; kcal: number }
  >();
  const add = (label: string, units: number) => {
    const staple = STAPLE_PROTEIN.find((s) => s.label === label);
    if (!staple) return;
    const prev = totals.get(label) ?? { units: 0, grams: 0, carbs: 0, fat: 0, kcal: 0 };
    totals.set(label, {
      units: prev.units + units,
      grams: prev.grams + units * staple.perUnit,
      carbs: prev.carbs + units * staple.carbsPerUnit,
      fat: prev.fat + units * staple.fatPerUnit,
      kcal: prev.kcal + units * staple.kcalPerUnit,
    });
  };

  for (const key of MEAL_KEYS) {
    // Picked staples win for THIS occasion and the free text is then skipped:
    // a dietitian who taps "Roti × 2" and also writes "2 rotis with dal" means
    // one meal, not two, and counting both would inflate the day.
    const picks = list(a, stapleQuestionId(key))
      .map(decodeStaplePick)
      .filter((p): p is { label: string; units: number } => p !== null);
    if (picks.length > 0) {
      for (const p of picks) add(p.label, p.units);
      continue;
    }

    const text = val(a, `q28_${key}_food`);
    if (!text.trim()) continue;
    for (const part of text.split(/[+,;·]/)) {
      const segment = part.trim();
      if (!segment) continue;
      const staple = STAPLE_PROTEIN.find((s) => s.pattern.test(segment));
      if (!staple) continue;
      const num = segment.match(/(\d+(?:\.\d+)?)/);
      // A gram/ml figure is a weight, not a count of servings — "curd 100 g"
      // must not be read as 100 rotis' worth.
      const isWeight = /\d\s*(g|gm|gram|ml)\b/i.test(segment);
      const units = num && !isWeight ? Math.min(10, parseFloat(num[1])) : staple.defaultUnits;
      add(staple.label, units);
    }
  }
  return Array.from(totals, ([label, v]) => ({
    label,
    units: v.units,
    gramsPerDay: v.grams,
    carbsPerDay: v.carbs,
    fatPerDay: v.fat,
    kcalPerDay: v.kcal,
  })).sort((x, y) => y.gramsPerDay - x.gramsPerDay);
}

// ---------------------------------------------------------------------------
// Drinks
//
// These were captured as free text and then counted by nobody. Three cups of
// sweet milk tea is around 200 kcal and 5 g of protein a day — for a client
// eating 1,400 kcal that is a seventh of the day, invisible, and it lands
// straight in the gap between what the counselling measures and what the
// client actually eats.
//
// Same shape as the staples so they price the same way: tapped picks first,
// and the pattern is used to read drinks out of counsellings recorded before
// the picker existed.
// ---------------------------------------------------------------------------

const BEVERAGES: {
  pattern: RegExp;
  label: string;
  perUnit: number;
  carbsPerUnit: number;
  fatPerUnit: number;
  kcalPerUnit: number;
  defaultUnits: number;
  /**
   * How specific this entry is, when more than one pattern matches the same
   * words. "Green tea" and "black coffee" both contain a generic drink, so the
   * specific reading has to win — stated as a number rather than inferred from
   * the order or the pattern length, both of which get this silently wrong.
   */
  priority?: number;
}[] = [
  // Milk tea is the default reading of "chai"/"tea" in this client base, and
  // sugar is asked separately because it is most of the difference.
  { pattern: /\b(tea|chai)\b/i, label: "Tea with sugar", perUnit: 1.8, carbsPerUnit: 9.5, fatPerUnit: 2.4, kcalPerUnit: 70, defaultUnits: 2 },
  { pattern: /\b(tea|chai)\b.*\b(no|without|zero)\s*sugar\b/i, priority: 2, label: "Tea without sugar", perUnit: 1.8, carbsPerUnit: 4.5, fatPerUnit: 2.4, kcalPerUnit: 47, defaultUnits: 2 },
  { pattern: /\b(green tea|black tea|herbal tea)\b/i, priority: 3, label: "Green or black tea", perUnit: 0, carbsPerUnit: 0.3, fatPerUnit: 0, kcalPerUnit: 2, defaultUnits: 1 },
  { pattern: /\bcoffee\b/i, label: "Coffee with sugar", perUnit: 2, carbsPerUnit: 10, fatPerUnit: 2.6, kcalPerUnit: 75, defaultUnits: 1 },
  { pattern: /\bblack coffee\b/i, priority: 2, label: "Black coffee", perUnit: 0.3, carbsPerUnit: 0, fatPerUnit: 0, kcalPerUnit: 5, defaultUnits: 1 },
  { pattern: /\b(milk|doodh)\b/i, label: "Milk", perUnit: 6.4, carbsPerUnit: 9.7, fatPerUnit: 6.6, kcalPerUnit: 122, defaultUnits: 1 },
  { pattern: /\b(buttermilk|chaas|chhach)\b/i, label: "Buttermilk or chaas", perUnit: 3, carbsPerUnit: 5, fatPerUnit: 1.5, kcalPerUnit: 48, defaultUnits: 1 },
  { pattern: /\blassi\b/i, label: "Lassi", perUnit: 4.6, carbsPerUnit: 25, fatPerUnit: 5, kcalPerUnit: 160, defaultUnits: 1 },
  { pattern: /\b(fresh juice|nimbu paani|lemonade|sugarcane)\b/i, label: "Fresh juice", perUnit: 0.8, carbsPerUnit: 24, fatPerUnit: 0.2, kcalPerUnit: 100, defaultUnits: 1 },
  { pattern: /\b(packaged juice|tetra|frooti|maaza)\b/i, label: "Packaged juice", perUnit: 0.4, carbsPerUnit: 26, fatPerUnit: 0.1, kcalPerUnit: 108, defaultUnits: 1 },
  { pattern: /\b(cola|soft drink|soda|pepsi|coke|thums)\b/i, label: "Soft drink", perUnit: 0, carbsPerUnit: 33, fatPerUnit: 0, kcalPerUnit: 132, defaultUnits: 1 },
  { pattern: /\b(diet|zero)\s*(coke|cola|soda|soft drink)\b/i, priority: 2, label: "Diet soft drink", perUnit: 0, carbsPerUnit: 0, fatPerUnit: 0, kcalPerUnit: 1, defaultUnits: 1 },
  { pattern: /\b(coconut water|nariyal)\b/i, label: "Coconut water", perUnit: 0.4, carbsPerUnit: 7.6, fatPerUnit: 0.2, kcalPerUnit: 38, defaultUnits: 1 },
  // Not "protein powder" — that is a Q50 protein food and a tappable variant
  // food, so matching it here as well would count one shake twice.
  { pattern: /\b(protein shake|whey)\b/i, label: "Protein shake", perUnit: 24, carbsPerUnit: 3, fatPerUnit: 1.5, kcalPerUnit: 120, defaultUnits: 1 },
  // Worth recording rather than leaving blank: "water only" is an answer, an
  // empty field is an unasked question.
  { pattern: /\bwater only\b/i, label: "Water only", perUnit: 0, carbsPerUnit: 0, fatPerUnit: 0, kcalPerUnit: 0, defaultUnits: 1 },
];

/** The drinks offered by the picker, in tap order. */
export const BEVERAGE_LABELS: string[] = BEVERAGES.map((b) => b.label);

export const beverageQuestionId = (mealKey: string) => `q28_${mealKey}_drinks`;

/**
 * Drinks per day across the whole recorded day.
 *
 * Counted on TOP of the meals: a variant records what was eaten at breakfast,
 * and the tea alongside it is recorded here. Nothing in the variant capture
 * offers a drink, so there is no double count to guard against.
 */
export function beverageIntake(a: Answers): StapleContribution[] {
  const totals = new Map<
    string,
    { units: number; grams: number; carbs: number; fat: number; kcal: number }
  >();
  const add = (label: string, units: number) => {
    const drink = BEVERAGES.find((b) => b.label === label);
    if (!drink) return;
    const prev = totals.get(label) ?? { units: 0, grams: 0, carbs: 0, fat: 0, kcal: 0 };
    totals.set(label, {
      units: prev.units + units,
      grams: prev.grams + units * drink.perUnit,
      carbs: prev.carbs + units * drink.carbsPerUnit,
      fat: prev.fat + units * drink.fatPerUnit,
      kcal: prev.kcal + units * drink.kcalPerUnit,
    });
  };

  for (const key of MEAL_KEYS) {
    const picks = list(a, beverageQuestionId(key))
      .map(decodeStaplePick)
      .filter((p): p is { label: string; units: number } => p !== null);
    if (picks.length > 0) {
      for (const p of picks) add(p.label, p.units);
      continue;
    }
    // Counsellings recorded before the picker typed it instead — and typed it
    // in either field, because "Poha 1 plate + tea with 1 tsp sugar" is one
    // sentence to a dietitian even though the form offered two boxes. Staples
    // and drinks share no labels, so reading the food text for drinks cannot
    // double-count what stapleProtein already found in it.
    const text = [val(a, `q28_${key}_beverage`), val(a, `q28_${key}_food`)]
      .filter((t) => t.trim())
      .join("; ");
    if (!text.trim()) continue;
    for (const part of text.split(/[+,;·]/)) {
      const segment = part.trim();
      if (!segment) continue;
      // The most specific match wins: "green tea" must not be read as "tea
      // with sugar", nor "black coffee" as "coffee with sugar".
      const drink = BEVERAGES.filter((b) => b.pattern.test(segment)).sort(
        (x, y) => (y.priority ?? 1) - (x.priority ?? 1)
      )[0];
      if (!drink) continue;
      const num = segment.match(/(\d+(?:\.\d+)?)/);
      const isWeight = /\d\s*(g|gm|gram|ml)\b/i.test(segment);
      const units = num && !isWeight ? Math.min(10, parseFloat(num[1])) : drink.defaultUnits;
      add(drink.label, units);
    }
  }

  return Array.from(totals, ([label, v]) => ({
    label,
    units: v.units,
    gramsPerDay: v.grams,
    carbsPerDay: v.carbs,
    fatPerDay: v.fat,
    kcalPerDay: v.kcal,
  })).sort((x, y) => y.kcalPerDay - x.kcalPerDay);
}

export interface FoodContribution {
  food: ProteinFood;
  perWeek: number;
  multiplier: number;
  /** Grams of protein this food contributes per DAY. */
  gramsPerDay: number;
  carbsPerDay: number;
  fatPerDay: number;
  kcalPerDay: number;
}

export interface ProteinIntakeEstimate {
  /** Estimated protein the client eats now, g/day. */
  gramsPerDay: number;
  /** Per kg bodyweight, or null when weight was not recorded. */
  gramsPerKg: number | null;
  /** Estimated carbohydrate the client eats now, g/day. Descriptive only. */
  carbsPerDay: number;
  /** Estimated fat the client eats now, g/day. Descriptive only. */
  fatPerDay: number;
  /** Estimated energy from everything counted here, kcal/day. */
  kcalPerDay: number;
  /**
   * Share of energy from each macro, as whole percentages summing to 100.
   *
   * Computed from the macros (4/4/9 kcal per g) rather than from `kcalPerDay`,
   * which comes from the database's own energy column and can differ by a few
   * percent (fibre, rounding, sugar alcohols). Deriving the split from the
   * macros is what makes the three shares total 100 — the same precedent
   * `reconcileMeal` in nutrition.ts follows when the two disagree.
   */
  energySplit: { protein: number; carbs: number; fat: number };
  /** Highest-contributing foods first; only foods actually eaten. */
  contributions: FoodContribution[];
  /** Foods selected in q50 that have no frequency recorded yet. */
  unrecorded: ProteinFood[];
  /** Staples from the Q28 food day (roti, rice, sabzi) — not Q50 foods. */
  staples: StapleContribution[];
  /**
   * Drinks recorded across the day, counted on top of the meals.
   *
   * Separate from `staples` and `contributions` because they are neither: a
   * drink is not part of any meal variant, and until this existed it was the
   * one thing the counselling recorded and then never counted.
   */
  beverages: StapleContribution[];
  /** Energy per day from those drinks — usually the whole reason to ask. */
  beverageKcalPerDay: number;
  /** Protein per day contributed by those staples. */
  stapleGramsPerDay: number;
  /**
   * Whether the food day actually contributed anything, and if not, why.
   *
   * Almost all of a client's carbohydrate lives in the staples, so a food day
   * that yields none makes the estimate read as a very low-carb, very
   * high-fat diet that nobody is really eating. The two failures need
   * different words: "none" is a form still being filled in, "unmatched" is a
   * dietitian who DID record the day in wording the parser could not read —
   * that one looks identical to a complete form and is the dangerous case.
   */
  foodDay: "counted" | "unmatched" | "none";
  /** True once at least one food has a frequency — the estimate is meaningful. */
  measured: boolean;
  /**
   * Where the numbers came from. "variants" is the measured meal capture;
   * "legacy" is the food-by-food frequency/portion form it replaced, kept so
   * counsellings taken before the change still open and still generate.
   */
  source: "variants" | "legacy";
  /** The per-meal breakdown, when source is "variants". */
  variants?: VariantIntake;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

const bodyWeightKg = (a: Answers): number | null => {
  const w = Number(val(a, "q9_weight"));
  return Number.isFinite(w) && w > 0 ? w : null;
};

/**
 * Estimates current daily protein from the recorded frequency and portion of
 * each protein food the client eats. Foods selected in q50 but not yet given a
 * frequency contribute nothing and are reported separately, so a half-filled
 * form reads as incomplete rather than as a genuinely low intake.
 */
export function estimateProteinIntake(a: Answers): ProteinIntakeEstimate {
  // Recorded meal variants supersede everything below. They measure the same
  // thing far better: real portions of real meals, priced against the foods
  // table the diet plan is costed with, weighted by how many days a week each
  // one is actually eaten. The legacy path stays for counsellings taken before
  // variants existed, which still have to open and still have to generate.
  const variants = variantIntake(a);
  const beverages = beverageIntake(a);
  const drinks = beverages.reduce(
    (t, b) => ({
      protein: t.protein + b.gramsPerDay,
      carbs: t.carbs + b.carbsPerDay,
      fat: t.fat + b.fatPerDay,
      kcal: t.kcal + b.kcalPerDay,
    }),
    { protein: 0, carbs: 0, fat: 0, kcal: 0 }
  );

  if (variants.recorded) {
    // The meals as measured, plus what was drunk alongside them — UNLESS the
    // dietitian overrode the whole day outright. That override is seeded from
    // (and displayed as) a total that already includes the drinks, so it is
    // already everything; adding drinks again would double-count them, and
    // since IntakeOverride reseeds its next edit from this same recomputed
    // total, the double-count would compound further on every subsequent
    // edit — the number visibly drifting upward each time anything is typed.
    const protein_g = variants.overridden
      ? round1(variants.perDay.protein_g)
      : round1(variants.perDay.protein_g + drinks.protein);
    const carbs_g = variants.overridden
      ? round1(variants.perDay.carbs_g)
      : round1(variants.perDay.carbs_g + drinks.carbs);
    const fat_g = variants.overridden
      ? round1(variants.perDay.fat_g)
      : round1(variants.perDay.fat_g + drinks.fat);
    const calories = variants.overridden
      ? Math.round(variants.perDay.calories)
      : Math.round(variants.perDay.calories + drinks.kcal);
    const weight = bodyWeightKg(a);
    const macroKcal = 4 * protein_g + 4 * carbs_g + 9 * fat_g;
    const share = (kcal: number) => (macroKcal > 0 ? Math.round((kcal / macroKcal) * 100) : 0);
    return {
      gramsPerDay: protein_g,
      gramsPerKg: weight ? Math.round((protein_g / weight) * 100) / 100 : null,
      carbsPerDay: carbs_g,
      fatPerDay: fat_g,
      kcalPerDay: calories,
      energySplit: {
        protein: share(4 * protein_g),
        carbs: share(4 * carbs_g),
        fat: share(9 * fat_g),
      },
      contributions: [],
      unrecorded: [],
      staples: [],
      stapleGramsPerDay: 0,
      beverages,
      beverageKcalPerDay: Math.round(drinks.kcal),
      foodDay: "counted",
      measured: true,
      source: "variants",
      variants,
    };
  }

  const selected = list(a, "q50");
  const contributions: FoodContribution[] = [];
  const unrecorded: ProteinFood[] = [];

  for (const food of PROTEIN_FOODS) {
    if (!selected.includes(food.label)) continue;
    const freqLabel = val(a, freqQuestionId(food.id));
    const freq = FREQUENCY_OPTIONS.find((f) => f.label === freqLabel);
    if (!freq) {
      unrecorded.push(food);
      continue;
    }
    if (freq.perWeek === 0) continue;
    const portionLabel = val(a, portionQuestionId(food.id));
    const multiplier =
      PORTION_OPTIONS.find((p) => p.label === portionLabel)?.multiplier ?? 1;
    // One factor for all four nutrients: how much of a standard portion, how
    // many days a week, spread over seven.
    const perDay = (multiplier * freq.perWeek) / 7;
    contributions.push({
      food,
      perWeek: freq.perWeek,
      multiplier,
      gramsPerDay: food.proteinPerPortion * perDay,
      carbsPerDay: food.carbsPerPortion * perDay,
      fatPerDay: food.fatPerPortion * perDay,
      kcalPerDay: food.kcalPerPortion * perDay,
    });
  }

  contributions.sort((x, y) => y.gramsPerDay - x.gramsPerDay);
  // Q50 covers the protein foods; the recorded food day covers the roti, rice
  // and sabzi that carry protein but are nobody's idea of a protein food.
  const staples = stapleProtein(a);
  const sum = (
    key: "gramsPerDay" | "carbsPerDay" | "fatPerDay" | "kcalPerDay"
  ): number =>
    contributions.reduce((s, c) => s + c[key], 0) +
    staples.reduce((s, c) => s + c[key], 0) +
    beverages.reduce((s, c) => s + c[key], 0);

  const stapleGrams = staples.reduce((s, c) => s + c.gramsPerDay, 0);
  const gramsPerDay = sum("gramsPerDay");
  const carbsPerDay = sum("carbsPerDay");
  const fatPerDay = sum("fatPerDay");
  const weight = bodyWeightKg(a);

  const macroKcal = 4 * gramsPerDay + 4 * carbsPerDay + 9 * fatPerDay;
  const share = (kcal: number) => (macroKcal > 0 ? Math.round((kcal / macroKcal) * 100) : 0);

  return {
    gramsPerDay: Math.round(gramsPerDay),
    gramsPerKg: weight ? Math.round((gramsPerDay / weight) * 100) / 100 : null,
    carbsPerDay: Math.round(carbsPerDay),
    fatPerDay: Math.round(fatPerDay),
    kcalPerDay: Math.round(sum("kcalPerDay")),
    beverages,
    beverageKcalPerDay: Math.round(drinks.kcal),
    energySplit: {
      protein: share(4 * gramsPerDay),
      carbs: share(4 * carbsPerDay),
      fat: share(9 * fatPerDay),
    },
    contributions,
    unrecorded,
    staples,
    stapleGramsPerDay: Math.round(stapleGrams),
    foodDay:
      staples.length > 0
        ? "counted"
        : MEAL_KEYS.some((k) => val(a, `q28_${k}_food`).trim())
          ? "unmatched"
          : "none",
    measured: contributions.length > 0 || staples.length > 0,
    source: "legacy",
  };
}

// ---------------------------------------------------------------------------
// Week-1 target
// ---------------------------------------------------------------------------

// The progression the dietitians asked for: raise what the client already eats
// by this much, so week 1 is a change they can keep.
const INCREASE_LOW = 0.1;
const INCREASE_HIGH = 0.15;

// Where the client should END UP, in g per kg bodyweight — NOT the week-1
// target. A client eating 26 g/day is not asked to eat 118 g next week; the
// weekly +10-15% step walks them there over a couple of months, which is the
// whole point of progressing from measured intake. These are starting
// defaults, not a clinical protocol: confirm them against the dietitian team's
// own standard.
// Resistance training 3+ days a week, losing fat — protein protects muscle
// through the deficit.
const GOAL_TRAINING_FAT_LOSS = 1.6;
// Resistance training 3+ days a week, not in a deficit.
const GOAL_ACTIVE = 1.4;
// Everyone else, including walkers and yoga practitioners: cardio and mobility
// do not create the same protein requirement as lifting.
const GOAL_DEFAULT = 1.2;

export interface ProteinTarget {
  /** The number THIS week's plan must hit, g/day. */
  targetG: number;
  /** Where the client should end up, g/day. */
  goalG: number;
  /** The raw 10-15% band this week's step was drawn from. */
  bandG: [number, number];
  /** Weeks of +10-15% steps still needed to reach goalG; 0 once there. */
  weeksToGoal: number;
  /** Which rule decided the target. */
  basis: "progression" | "goal-reached" | "medical-cap" | "unmeasured";
  /** One line for the dietitian and for the plan record. */
  explanation: string;
}

// Q43 answers that count as resistance training. Only these raise the protein
// goal: the higher g/kg figures exist to support muscle under load, and
// counting exercise days alone put a client whose Q43 was "Walking, Yoga" on
// the 1.6 g/kg goal meant for people who lift. Deliberately strict — add
// "Home workout", "HIIT" or "Starting with LeanR PT" here if the team counts
// them as resistance work.
const RESISTANCE_TRAINING = ["Strength training"];

// Resistance training at a frequency that actually drives a protein
// requirement — the exercise type AND at least three sessions a week.
const doesResistanceTraining = (a: Answers): boolean => {
  const days = Number(val(a, "q44a"));
  if (!Number.isFinite(days) || days < 3) return false;
  return list(a, "q43").some((v) => RESISTANCE_TRAINING.includes(v));
};

const isFatLoss = (a: Answers): boolean =>
  /fat loss|weight loss/i.test(val(a, "q2")) || /fat loss/i.test(val(a, "q44f"));

/**
 * Medical restriction on raising protein — a recorded kidney or liver
 * condition, or an explicit protein limit written into the hard constraints.
 * Never auto-raises past these; the dietitian decides with the doctor.
 */
export function medicalProteinCap(a: Answers): string | null {
  const conditions = [...list(a, "q17"), ...list(a, "q18")].join(" ").toLowerCase();
  if (/kidney|renal|nephro|dialysis|liver|hepatic|cirrhosis/.test(conditions)) {
    return "kidney or liver condition recorded";
  }
  // ds2 is the hard-constraints box ("protein max 60 g/day per nephrologist" is
  // its own placeholder); q19a is the medicines box, where a renal protein limit
  // is often written instead. This read q104 — a multi-select about whether the
  // strategy changed after the client discussion — so `val` returned "" every
  // time and a typed protein limit never capped anything.
  const constraints = `${val(a, "ds2")} ${val(a, "q19a")}`.toLowerCase();
  if (/protein\s*(max|limit|cap|restrict|≤|<)/.test(constraints)) {
    return "a protein limit is recorded in the clinical constraints";
  }
  return null;
}

function goalGPerKg(a: Answers): number {
  if (!doesResistanceTraining(a)) return GOAL_DEFAULT;
  return isFatLoss(a) ? GOAL_TRAINING_FAT_LOSS : GOAL_ACTIVE;
}

// Compounding +step weeks from `from` to `to`, for the "about N weeks away"
// line. Bounded so a near-zero measured intake cannot report a huge number.
function weeksBetween(from: number, to: number, step: number): number {
  if (from <= 0 || to <= from) return 0;
  return Math.min(52, Math.ceil(Math.log(to / from) / Math.log(1 + step)));
}

/**
 * This week's protein target: the client's measured intake stepped up 10-15%,
 * walking toward a g/kg goal rather than jumping to it. A client eating 26 g
 * gets 30 g next week, not the 118 g their bodyweight ultimately calls for —
 * the counselling asks at length about restriction and dropout patterns, and a
 * 350% overnight change is exactly what those questions exist to prevent.
 *
 * `fromTargetG` continues the ramp for a later week: pass the previous week's
 * target and the step is taken from there instead of from the original
 * measurement. Week-1 generation leaves it undefined; wiring it into the
 * follow-up path is what makes the ramp real week after week.
 */
export function proteinTarget(
  a: Answers,
  estimate: ProteinIntakeEstimate,
  fromTargetG?: number
): ProteinTarget {
  const base = fromTargetG && fromTargetG > 0 ? fromTargetG : estimate.gramsPerDay;
  const band: [number, number] = [
    Math.round(base * (1 + INCREASE_LOW)),
    Math.round(base * (1 + INCREASE_HIGH)),
  ];
  const weight = bodyWeightKg(a);
  const perKg = goalGPerKg(a);
  const goal = weight ? Math.round(weight * perKg) : 0;

  const cap = medicalProteinCap(a);
  if (cap) {
    return {
      targetG: estimate.gramsPerDay,
      goalG: estimate.gramsPerDay,
      bandG: band,
      weeksToGoal: 0,
      basis: "medical-cap",
      explanation: `Protein held at the current ${estimate.gramsPerDay} g/day — ${cap}. Any increase must come from the treating doctor.`,
    };
  }

  if (!estimate.measured) {
    return {
      targetG: 0,
      goalG: goal,
      bandG: band,
      weeksToGoal: 0,
      basis: "unmeasured",
      explanation:
        "No protein-food frequency recorded yet — record how often each protein food is eaten to measure current intake and set the target.",
    };
  }

  // Midpoint of the requested 10-15% band, and never past the goal.
  const step = (INCREASE_LOW + INCREASE_HIGH) / 2;
  const stepped = Math.round(base * (1 + step));

  if (goal > 0 && stepped >= goal) {
    return {
      targetG: goal,
      goalG: goal,
      bandG: band,
      weeksToGoal: 0,
      basis: "goal-reached",
      explanation: `Current intake ${estimate.gramsPerDay} g/day; a 10-15% step reaches the ${perKg} g/kg goal, so the target is ${goal} g/day.`,
    };
  }

  return {
    targetG: stepped,
    goalG: goal,
    bandG: band,
    weeksToGoal: weeksBetween(stepped, goal, step),
    basis: "progression",
    explanation:
      `Current intake ${estimate.gramsPerDay} g/day (${estimate.gramsPerKg ?? "?"} g/kg). ` +
      `This week: ${stepped} g/day, a ${Math.round(((stepped - base) / Math.max(1, base)) * 100)}% step. ` +
      (goal > 0
        ? `Goal ${goal} g/day (${perKg} g/kg) — about ${weeksBetween(stepped, goal, step)} more weekly steps away.`
        : `Record the client's current weight to set the long-term goal.`),
  };
}

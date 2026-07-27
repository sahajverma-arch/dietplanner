// What the client ACTUALLY eats at each meal, in the shape they describe it.
//
// Nobody eats one fixed breakfast. They eat bread and eggs three days, poha on
// one, chilla on another — and the old form had no way to record that, so it
// asked for a free-text "typical weekday" and then interrogated protein food by
// food, frequency by frequency, after the client had already described their
// day. Clients found the second pass exhausting and the answers drifted,
// because nobody re-derives the same week twice the same way.
//
// Here a meal holds VARIANTS: each one is a real thing they eat, with its items
// and how many days a week it happens. Protein is then DERIVED from that —
// counted once, from food already on the table, rather than asked again.
//
// Every number is measured against the same foods table the diet plans are
// costed with, and every number can be overridden: a database match is a good
// estimate, not gospel, and the dietitian in the room knows when it is wrong.

import type { Answers } from "./questions";
import { MEAL_OCCASIONS } from "./meal-occasions";

/** One food inside a variant: "Bread", "4 slices". */
export interface VariantItem {
  food: string;
  qty: string;
}

export interface VariantMacros {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface MealVariant {
  /** Stable id so the UI can re-render rows without losing focus. */
  id: string;
  /** What the dietitian calls it ("Bread omelette"); optional. */
  label: string;
  items: VariantItem[];
  /** How many days a week this particular version is eaten. */
  daysPerWeek: number;
  /** Priced from the foods table. Absent until it has been priced. */
  measured?: VariantMacros;
  /** The dietitian's correction, which always wins over `measured`. */
  override?: VariantMacros;
  /** Foods the table could not price — `measured` excludes them. */
  unpriced?: string[];
}

/**
 * The occasions that get variant boxes: where variation and protein actually
 * live. The rest of the day (wake-up drinks, tasting while cooking, alcohol)
 * keeps the simpler capture — those rarely vary and rarely carry protein.
 */
export const VARIANT_MEAL_KEYS = [
  "breakfast",
  "midmorning",
  "lunch",
  "afternoon",
  "evening",
  // Post-workout is where a training client's protein concentrates — shakes,
  // eggs, milk. Leaving it out understated their measured intake, and since
  // the week-1 target is that intake raised 10-15%, it understated the target
  // too: Aadi's two post-workout eggs alone are 8 g/day.
  "postworkout",
  "dinner",
] as const;

export const VARIANT_MEALS = VARIANT_MEAL_KEYS.map((key) => ({
  key,
  label: MEAL_OCCASIONS.find((m) => m.key === key)?.label ?? key,
}));

/** Answer key holding one meal's variants, as JSON. */
export const variantsQuestionId = (mealKey: string) => `q112_${mealKey}_variants`;

/**
 * The foods a dietitian can TAP rather than type, per meal.
 *
 * Typing a food name mid-consultation is the thing that makes a form feel
 * slow, so the everyday vocabulary is tappable: the carbohydrate staples that
 * carry most of a plate, plus the protein foods this client's pattern allows —
 * a vegetarian consultation should not offer chicken, and the old staples list
 * offered no eggs, paneer or dal at all, so protein could never be tapped.
 *
 * Anything outside this list is still typed; the list only has to cover the
 * common case to save the typing that matters.
 */
export function variantFoodOptions(staples: string[], proteinFoods: string[]): string[] {
  const seen = new Set<string>();
  return [...staples, ...proteinFoods].filter((f) => {
    const key = f.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * How many of a food a tap adds, and what one of them is called.
 *
 * Counted foods ("2 eggs", "4 bread") are a bare number, which is what the
 * grounding reads as a count of servings. Foods measured by vessel get their
 * household measure, because "1 dal" is not a quantity anyone can price.
 */
const VESSEL_FOODS: Record<string, string> = {
  Rice: "katori",
  Poha: "bowl",
  Upma: "bowl",
  Khichdi: "bowl",
  Sabzi: "katori",
  Salad: "bowl",
  Dal: "katori",
  Milk: "glass",
  Curd: "katori",
  "Buttermilk or chaas": "glass",
  "Greek or high-protein yogurt": "katori",
  "Chickpeas or chole": "katori",
  "Rajma or beans": "katori",
  Sprouts: "katori",
  "Soy chunks": "katori",
  Chicken: "katori",
  Fish: "katori",
  Seafood: "katori",
  Meat: "katori",
  "Nuts or seeds": "handful",
  "Roasted chana": "handful",
  "Protein powder": "scoop",
  Paneer: "g",
  Tofu: "g",
  Tempeh: "g",
};

/** The quantity string a tapped food carries at `units` taps. */
export function tappedQuantity(food: string, units: number): string {
  const unit = VESSEL_FOODS[food];
  if (!unit) return String(units);
  // Paneer and tofu are weighed, and 50 g steps are how dietitians think.
  if (unit === "g") return `${units * 50} g`;
  return `${units} ${unit}${units > 1 && unit !== "g" ? "s" : ""}`;
}

/** Answer key holding the dietitian's override of the whole daily intake. */
export const INTAKE_OVERRIDE_ID = "q112_intake_override";

const EMPTY: VariantMacros = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

const isMacros = (v: unknown): v is VariantMacros =>
  !!v &&
  typeof v === "object" &&
  ["calories", "protein_g", "carbs_g", "fat_g"].every(
    (k) => typeof (v as Record<string, unknown>)[k] === "number"
  );

/**
 * Variants are stored as JSON in a single answer, because `Answers` holds
 * strings — the same trick the staple picker uses with "Roti × 2", just with
 * more structure to carry. Unreadable or half-written values decode to an
 * empty list rather than throwing: a counselling form must never break on its
 * own saved draft.
 */
export function decodeVariants(raw: string | string[] | undefined): MealVariant[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((entry, i): MealVariant[] => {
    if (!entry || typeof entry !== "object") return [];
    const e = entry as Record<string, unknown>;
    const items = Array.isArray(e.items)
      ? e.items.flatMap((it): VariantItem[] => {
          if (!it || typeof it !== "object") return [];
          const food = String((it as Record<string, unknown>).food ?? "").trim();
          if (!food) return [];
          return [{ food, qty: String((it as Record<string, unknown>).qty ?? "").trim() }];
        })
      : [];
    const days = Number(e.daysPerWeek);
    return [
      {
        id: typeof e.id === "string" && e.id ? e.id : `v${i}`,
        label: String(e.label ?? "").trim(),
        items,
        daysPerWeek: Number.isFinite(days) ? Math.min(7, Math.max(0, days)) : 0,
        measured: isMacros(e.measured) ? e.measured : undefined,
        override: isMacros(e.override) ? e.override : undefined,
        unpriced: Array.isArray(e.unpriced) ? e.unpriced.map(String) : undefined,
      },
    ];
  });
}

export const encodeVariants = (variants: MealVariant[]): string => JSON.stringify(variants);

/** What this variant counts as: the dietitian's correction, else the measurement. */
export const macrosOf = (v: MealVariant): VariantMacros => v.override ?? v.measured ?? EMPTY;

/** True when the dietitian has corrected the database's numbers. */
export const isOverridden = (v: MealVariant): boolean => v.override !== undefined;

export const variantLabel = (v: MealVariant): string =>
  v.label.trim() || v.items.map((i) => i.food).join(", ") || "Untitled";

export interface MealIntake {
  key: string;
  label: string;
  variants: MealVariant[];
  /** Days a week this meal is eaten at all — the variants' days summed. */
  daysCovered: number;
  /** This meal's contribution to an average day. */
  perDay: VariantMacros;
}

export interface VariantIntake {
  meals: MealIntake[];
  /** Average day across every meal, weighted by how often each variant occurs. */
  perDay: VariantMacros;
  /** True once anything has been recorded — otherwise there is nothing to use. */
  recorded: boolean;
  /** Foods the database could not price, across the week. The totals exclude them. */
  unpriced: string[];
  /** Set when the dietitian overrode the daily totals outright. */
  overridden: boolean;
}

const scale = (m: VariantMacros, factor: number): VariantMacros => ({
  calories: m.calories * factor,
  protein_g: m.protein_g * factor,
  carbs_g: m.carbs_g * factor,
  fat_g: m.fat_g * factor,
});

const add = (a: VariantMacros, b: VariantMacros): VariantMacros => ({
  calories: a.calories + b.calories,
  protein_g: a.protein_g + b.protein_g,
  carbs_g: a.carbs_g + b.carbs_g,
  fat_g: a.fat_g + b.fat_g,
});

const round = (m: VariantMacros): VariantMacros => ({
  calories: Math.round(m.calories),
  protein_g: Math.round(m.protein_g),
  carbs_g: Math.round(m.carbs_g),
  fat_g: Math.round(m.fat_g),
});

/**
 * The client's average day, built from every variant weighted by how often it
 * is eaten. A breakfast eaten on 3 of 7 days contributes three sevenths of
 * itself — which is the whole reason variants exist, because a single
 * "typical breakfast" silently claimed all seven.
 */
export function variantIntake(a: Answers): VariantIntake {
  const meals: MealIntake[] = [];
  const unpriced = new Set<string>();
  let total: VariantMacros = EMPTY;
  let recorded = false;

  for (const { key, label } of VARIANT_MEALS) {
    const variants = decodeVariants(a[variantsQuestionId(key)]);
    if (variants.length === 0) continue;
    let perDay: VariantMacros = EMPTY;
    let daysCovered = 0;
    for (const v of variants) {
      if (v.items.length > 0) recorded = true;
      daysCovered += v.daysPerWeek;
      perDay = add(perDay, scale(macrosOf(v), v.daysPerWeek / 7));
      for (const name of v.unpriced ?? []) unpriced.add(name);
    }
    meals.push({ key, label, variants, daysCovered, perDay: round(perDay) });
    total = add(total, perDay);
  }

  // A dietitian who disagrees with the whole total overrides it outright; the
  // per-meal breakdown is still shown, but the number that leaves this module
  // is theirs.
  const raw = a[INTAKE_OVERRIDE_ID];
  let overridden = false;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (isMacros(parsed)) {
        total = parsed;
        overridden = true;
        recorded = true;
      }
    } catch {
      /* a malformed override is simply ignored */
    }
  }

  return {
    meals,
    perDay: round(total),
    recorded,
    unpriced: Array.from(unpriced),
    overridden,
  };
}

/**
 * Days of the week a meal's variants do not account for. Surfaced so the
 * dietitian notices "3 + 1 + 1" leaves two days unexplained — the gap is
 * usually a variant nobody mentioned, and it silently deflates the average.
 */
export const uncoveredDays = (meal: MealIntake): number => Math.max(0, 7 - meal.daysCovered);

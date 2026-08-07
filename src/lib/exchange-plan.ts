// The exchange-count solver — turns a day's macro target (from weekTargets()
// in roadmap.ts) into exchange-group counts, the same job a dietitian did by
// hand in the "Plan Builder" tab of the exchange-list spreadsheet.
//
// Pure arithmetic, no AI, no I/O: same inputs, same output, every time — same
// design contract as roadmap.ts. The 12 group anchors below mirror
// public.food_exchange_groups (seeded from scripts/data/food_exchanges.json);
// they are inlined rather than fetched so this solver can run with zero
// round trips, exactly the reason PROTEIN_REFERENCE is inlined into
// nutrition.ts instead of queried live. Regenerate both together if the
// spreadsheet source changes.
//
// STATUS: the underlying exchange values are DRAFT, not yet clinically
// reviewed (see the migration and scripts/data/food_exchanges.json).

import type { DietType } from "./types";
import {
  PROTEIN_LOW_TOLERANCE_G,
  PROTEIN_HIGH_FRACTION,
  CALORIE_LOW_FRACTION,
  CALORIE_HIGH_FRACTION,
} from "./day-targets";

export type ExchangeGroupId =
  | "pulses_legumes"
  | "soya_plant_protein"
  | "paneer_dairy"
  | "fluid_dairy"
  | "egg"
  | "poultry_fish_meat"
  | "fitty_protein"
  | "cereals_starches"
  | "vegetables"
  | "fruit"
  | "fats_oils"
  | "nuts_seeds";

interface ExchangeGroupAnchor {
  id: ExchangeGroupId;
  label: string;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  kcal: number;
  /**
   * What "1 exchange" of this group actually weighs — mirrors
   * public.food_exchange_groups.standard_serving (scripts/data/food_exchanges.json).
   * Matched foods carry their OWN serving_g (see toGrams() in nutrition.ts),
   * which OVERRIDES the generic household-measure table (PORTION_GUIDE) —
   * "1 katori" of an exchange-list food does not mean the generic 150 g.
   * This is what the PDF's portion guide shows instead for those foods.
   */
  standardServing: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const anchorKcal = (proteinG: number, carbsG: number, fatG: number) =>
  round1(proteinG * 4 + carbsG * 4 + fatG * 9);

/** Mirrors public.food_exchange_groups — see that table's comment. */
export const EXCHANGE_GROUPS: Record<ExchangeGroupId, ExchangeGroupAnchor> = {
  pulses_legumes: {
    id: "pulses_legumes", label: "Pulses & Legumes",
    proteinG: 7.0, carbsG: 17.5, fatG: 0.6, fiberG: 4.7, kcal: anchorKcal(7.0, 17.5, 0.6),
    standardServing: "30 g raw dal = 1 katori cooked",
  },
  soya_plant_protein: {
    id: "soya_plant_protein", label: "Soya & Plant Protein",
    proteinG: 7.8, carbsG: 4.2, fatG: 2.6, fiberG: 1.4, kcal: anchorKcal(7.8, 4.2, 2.6),
    standardServing: "15 g soya chunks dry / 90 g tofu",
  },
  paneer_dairy: {
    id: "paneer_dairy", label: "Paneer & Concentrated Dairy",
    proteinG: 7.6, carbsG: 2.1, fatG: 4.2, fiberG: 0.0, kcal: anchorKcal(7.6, 2.1, 4.2),
    standardServing: "35 g low-fat paneer / 70 g hung curd",
  },
  fluid_dairy: {
    id: "fluid_dairy", label: "Fluid Dairy",
    proteinG: 7.0, carbsG: 10.5, fatG: 4.4, fiberG: 0.0, kcal: anchorKcal(7.0, 10.5, 4.4),
    standardServing: "225 ml toned milk / 220 g curd",
  },
  egg: {
    id: "egg", label: "Egg",
    proteinG: 6.3, carbsG: 0.4, fatG: 5.0, fiberG: 0.0, kcal: anchorKcal(6.3, 0.4, 5.0),
    standardServing: "1 whole egg (2 whites = 7.3 g P, 0.2 g fat)",
  },
  poultry_fish_meat: {
    id: "poultry_fish_meat", label: "Poultry, Fish & Meat",
    proteinG: 7.7, carbsG: 0.1, fatG: 1.8, fiberG: 0.0, kcal: anchorKcal(7.7, 0.1, 1.8),
    standardServing: "35 g chicken breast / 45 g fish, raw",
  },
  fitty_protein: {
    id: "fitty_protein", label: "Fitty Protein",
    proteinG: 25.0, carbsG: 5.0, fatG: 2.1, fiberG: 2.8, kcal: anchorKcal(25.0, 5.0, 2.1),
    standardServing: "1 scoop (37 g) — exact, label-controlled",
  },
  cereals_starches: {
    id: "cereals_starches", label: "Cereals & Starches",
    proteinG: 3.2, carbsG: 21.5, fatG: 0.7, fiberG: 2.4, kcal: anchorKcal(3.2, 21.5, 0.7),
    standardServing: "30 g raw = 1 roti / half katori rice",
  },
  vegetables: {
    id: "vegetables", label: "Vegetables (non-starchy)",
    proteinG: 1.6, carbsG: 4.9, fatG: 0.2, fiberG: 2.6, kcal: anchorKcal(1.6, 4.9, 0.2),
    standardServing: "100 g raw = 1 katori",
  },
  fruit: {
    id: "fruit", label: "Fruit",
    proteinG: 1.1, carbsG: 15.0, fatG: 0.3, fiberG: 3.0, kcal: anchorKcal(1.1, 15.0, 0.3),
    standardServing: "1 portion = 15 g carbohydrate",
  },
  fats_oils: {
    id: "fats_oils", label: "Fats & Oils",
    proteinG: 0.0, carbsG: 0.0, fatG: 5.0, fiberG: 0.0, kcal: anchorKcal(0.0, 0.0, 5.0),
    standardServing: "5 g = 1 tsp oil or ghee",
  },
  nuts_seeds: {
    id: "nuts_seeds", label: "Nuts & Seeds",
    proteinG: 2.3, carbsG: 2.3, fatG: 5.2, fiberG: 1.4, kcal: anchorKcal(2.3, 2.3, 5.2),
    standardServing: "10 g = 8 almonds / 2 tbsp peanuts",
  },
};

/**
 * A few representative foods per group, names matching public.food_exchanges
 * rows (see scripts/data/food_exchanges.json) — not the full 88-row catalog,
 * just enough to anchor a prompt on foods this list actually prices, the same
 * role PROTEIN_REFERENCE plays for nim.ts today. Grounding still runs fuzzy
 * matching, so these don't need to be character-exact.
 */
export const EXCHANGE_FOOD_EXAMPLES: Record<ExchangeGroupId, string[]> = {
  pulses_legumes: ["Moong dal", "Masoor dal", "Toor dal", "Rajma", "Chana dal"],
  soya_plant_protein: ["Soya chunks", "Tofu", "Soya milk"],
  paneer_dairy: ["Paneer (low-fat)", "Hung curd", "Greek yogurt"],
  fluid_dairy: ["Toned milk", "Curd", "Buttermilk"],
  egg: ["Whole egg", "Egg white"],
  poultry_fish_meat: ["Chicken breast", "Fish (rohu/katla)", "Prawns"],
  fitty_protein: ["Fitty Protein"],
  cereals_starches: ["Roti (atta)", "Rice", "Oats", "Besan"],
  // Dish names, not the bare raw-vegetable names the underlying exchange rows
  // carry (see food_exchanges.json's "Bhindi / okra" etc.) — a client is
  // never served "1 cup Bhindi" on its own; grounding's fuzzy match still
  // finds the raw-vegetable row fine from a dish name like "Bhindi sabzi".
  vegetables: ["Palak sabzi", "Bhindi sabzi", "Cauliflower sabzi", "Lauki sabzi"],
  fruit: ["Apple", "Banana", "Papaya", "Guava"],
  fats_oils: ["Mustard oil", "Ghee", "Olive oil"],
  nuts_seeds: ["Almonds", "Peanuts", "Pumpkin seeds"],
};

/**
 * Whole-food protein groups, in the order the solver tries them — Indian
 * dietary-pattern preference, not pure protein-density ranking (which would
 * front-load poultry/fish onto every non-veg plan and ignore what a plate
 * actually looks like). Fitty Protein is deliberately absent: it is the
 * gap-filler tried only after this list, never a primary source.
 */
const WHOLE_FOOD_PROTEIN_ORDER: ExchangeGroupId[] = [
  "pulses_legumes",
  "paneer_dairy",
  "soya_plant_protein",
  "fluid_dairy",
  "egg",
  "poultry_fish_meat",
];

/** No single whole-food group carries more than this share of the day's protein target. */
const MAX_PROTEIN_SHARE_PER_GROUP = 0.5;
/**
 * No single whole-food protein group runs past this many exchanges/day,
 * whatever the target asks for — a percentage-of-target cap alone scales
 * with the target and so never actually stops the solver reaching for
 * unrealistic volume (21 exchanges of dal is not a serving size). 6
 * exchanges is already generous: 6 × pulses = 180 g raw dal, 6 × paneer =
 * 210 g paneer, both a lot to eat of one food in one day. This is what makes
 * Fitty Protein gap-fill actually trigger for high-protein/lower-calorie
 * targets, instead of the solver always finding a (nutritionally valid but
 * practically absurd) whole-food-only allocation.
 */
const MAX_EXCHANGES_PER_GROUP = 6;
/** Every plan gets vegetables regardless of what the macro solve alone would ask for — no real Indian diet plan has zero. */
const MIN_VEGETABLE_EXCHANGES = 2;
/** Standard 1-2 fruit servings/day, before any carb-residual top-up. */
const FRUIT_EXCHANGES_BASE = 1;
/** Fruit carries much less incidental protein per gram of carb than cereal
 *  (0.07 g protein/g carb vs cereal's 0.15), so a large carb residual is
 *  split toward fruit too, not dumped entirely on cereal — the reason week-1
 *  transition targets (a big carb allowance against a modest protein target)
 *  otherwise overshoot protein on cereal bulk alone. */
const FRUIT_CARB_SHARE = 0.25;
const MAX_FRUIT_EXCHANGES = 4;
/** Exchange-count rounding grain — "6.3 exchanges of dal" is not an instruction. */
const EXCHANGE_STEP = 0.5;
/** Fitty Protein ships in 1/4-scoop increments (see food_exchanges rows). */
const FITTY_STEP = 0.25;
const MAX_SOLVE_ROUNDS = 8;

const roundTo = (n: number, step: number) => Math.round(n / step) * step;

/** Group-level diet-type/Jain compatibility — mirrors scripts/seed-food-exchanges.mjs's GROUP_DEFAULT_TAGS, at group granularity (item-level exceptions, e.g. onion excluded from Jain, are handled when a specific food is picked from that group, not here). */
function groupAllowed(id: ExchangeGroupId, dietType: DietType, jain: boolean): boolean {
  if (jain && (id === "egg" || id === "poultry_fish_meat")) return false;
  if (id === "poultry_fish_meat") return dietType === "non-vegetarian";
  if (id === "egg") return dietType === "non-vegetarian" || dietType === "eggetarian";
  if (dietType === "vegan" && (id === "paneer_dairy" || id === "fluid_dairy")) return false;
  // Protein source unconfirmed (see food_exchanges seed comment) — excluded from vegan by default.
  if (dietType === "vegan" && id === "fitty_protein") return false;
  return true;
}

export interface ExchangeTarget {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
}

export interface ExchangePlanOptions {
  dietType: DietType;
  jain?: boolean;
  /**
   * Set exactly when roadmap.ts's RoadmapWarning "protein-held" fired for
   * this client. Mirrors buildRoadmap()'s own medical hold: no Fitty Protein,
   * no pushing a whole-food group past what the target already asks for —
   * the held protein number is the ceiling, not a floor to climb toward.
   */
  proteinHeld?: boolean;
}

export interface ExchangeCount {
  groupId: ExchangeGroupId;
  label: string;
  count: number;
}

export interface ExchangePlanResult {
  exchanges: ExchangeCount[];
  totals: ExchangeTarget;
  target: ExchangeTarget;
  proteinWithinBand: boolean;
  calorieWithinBand: boolean;
  fittyProteinUsed: boolean;
  warnings: string[];
}

type Totals = ExchangeTarget;

function sumTotals(counts: Partial<Record<ExchangeGroupId, number>>): Totals {
  let kcal = 0, proteinG = 0, carbsG = 0, fatG = 0, fiberG = 0;
  for (const [id, count] of Object.entries(counts) as [ExchangeGroupId, number][]) {
    if (!count) continue;
    const a = EXCHANGE_GROUPS[id];
    kcal += a.kcal * count;
    proteinG += a.proteinG * count;
    carbsG += a.carbsG * count;
    fatG += a.fatG * count;
    fiberG += a.fiberG * count;
  }
  return { kcal: round1(kcal), proteinG: round1(proteinG), carbsG: round1(carbsG), fatG: round1(fatG), fiberG: round1(fiberG) };
}

/**
 * Exchange counts to build one day's diet plan to `target`, or as close as
 * the exchange list allows.
 *
 * Every exchange group touches more than one macro (pulses carry both
 * protein and carbs; cereals carry both carbs and a little protein), so this
 * is a small coupled system, not four independent lookups — the same reason
 * the spreadsheet needed a variance table to check a manual guess. Solved by
 * fixed-point iteration: seed a reasonable allocation, measure the miss on
 * each macro, adjust the group(s) each macro maps to most cleanly (fat only
 * touches Fats & Oils; carbs mostly touch Cereals & Starches plus a smaller
 * Fruit share; protein is spread proportionally across every whole-food
 * protein group already in play, not a single fixed one — a fixed group
 * stalls once it hits its realistic cap and can't absorb the incidental
 * protein a growing Cereals allocation drags in). Repeats until each macro is
 * within tolerance or MAX_SOLVE_ROUNDS is reached.
 */
export function exchangePlanFor(target: ExchangeTarget, opts: ExchangePlanOptions): ExchangePlanResult {
  const { dietType, jain = false, proteinHeld = false } = opts;
  const warnings: string[] = [];

  const allowedProteinGroups = WHOLE_FOOD_PROTEIN_ORDER.filter((id) => groupAllowed(id, dietType, jain));

  const counts: Partial<Record<ExchangeGroupId, number>> = {
    vegetables: MIN_VEGETABLE_EXCHANGES,
    fruit: FRUIT_EXCHANGES_BASE,
  };

  // Seed: split the protein target across up to two whole-food groups so a
  // day is not built from a single food, capped per group so neither one
  // alone has to carry it — the same intent as roadmap.ts's own restraint
  // about not leaning the whole prescription on one lever.
  {
    let remaining = target.proteinG;
    const cap = target.proteinG * MAX_PROTEIN_SHARE_PER_GROUP;
    for (const id of allowedProteinGroups) {
      if (remaining <= EXCHANGE_STEP) break;
      const take = Math.min(remaining, cap);
      const a = EXCHANGE_GROUPS[id];
      const count = Math.min(roundTo(take / a.proteinG, EXCHANGE_STEP), MAX_EXCHANGES_PER_GROUP);
      if (count <= 0) continue;
      counts[id] = count;
      remaining -= count * a.proteinG;
    }
  }

  // Fixed-point refinement: fat via Fats & Oils (touches nothing else),
  // carbs via Cereals & Starches + Fruit (the residual, same philosophy as
  // roadmap.ts's own carbohydrate step), protein via EVERY whole-food group
  // currently in play, adjusted proportionally to its own share — not a
  // single fixed group, which stalls: cereal growth to hit a large carb
  // target drags real incidental protein with it, and only one lever left
  // fixed after round 1 could not absorb that. Each round narrows the miss
  // the previous round's side effects introduced.
  for (let round = 0; round < MAX_SOLVE_ROUNDS; round++) {
    const totals = sumTotals(counts);
    const proteinErr = target.proteinG - totals.proteinG;
    const fatErr = target.fatG - totals.fatG;
    const carbErr = target.carbsG - totals.carbsG;

    const proteinOff = Math.abs(proteinErr) > 0.5;
    const fatOff = Math.abs(fatErr) > 0.5;
    const carbOff = Math.abs(carbErr) > 1;
    if (!proteinOff && !fatOff && !carbOff) break;

    if (fatOff) {
      const a = EXCHANGE_GROUPS.fats_oils;
      counts.fats_oils = Math.max(0, (counts.fats_oils ?? 0) + fatErr / a.fatG);
    }
    if (carbOff) {
      const fruitRoom = Math.max(0, MAX_FRUIT_EXCHANGES - (counts.fruit ?? 0));
      const fruitA = EXCHANGE_GROUPS.fruit;
      const fruitCarbTake = carbErr > 0 ? Math.min(carbErr * FRUIT_CARB_SHARE, fruitRoom * fruitA.carbsG) : carbErr * FRUIT_CARB_SHARE;
      counts.fruit = Math.max(0, (counts.fruit ?? 0) + fruitCarbTake / fruitA.carbsG);
      const cerealA = EXCHANGE_GROUPS.cereals_starches;
      counts.cereals_starches = Math.max(0, (counts.cereals_starches ?? 0) + (carbErr - fruitCarbTake) / cerealA.carbsG);
    }
    if (proteinOff) {
      // Increasing whole-food protein is off-limits under a medical hold —
      // the held number is a ceiling, not a floor to climb toward. Reducing
      // it is still allowed and necessary: cereal/fruit growth above can
      // push protein over the hold, and that has to come back down from
      // somewhere.
      if (proteinErr > 0 && proteinHeld) continue;
      let active = allowedProteinGroups.filter((id) => (counts[id] ?? 0) > 0);
      // Still short and every active group is already at its realistic cap —
      // bring in the next allowed-but-unused group rather than pushing an
      // already-maxed one further past it.
      if (proteinErr > 0 && active.every((id) => (counts[id] ?? 0) >= MAX_EXCHANGES_PER_GROUP)) {
        const next = allowedProteinGroups.find((id) => !(id in counts));
        if (next) active = [...active, next];
      }
      const pool = active.length ? active : proteinErr > 0 ? allowedProteinGroups.slice(0, 1) : [];
      if (!pool.length) continue;
      const shareBase = pool.reduce((s, id) => s + (counts[id] ?? 0) * EXCHANGE_GROUPS[id].proteinG, 0) || 1;
      for (const id of pool) {
        const a = EXCHANGE_GROUPS[id];
        const share = ((counts[id] ?? 0) * a.proteinG) / shareBase || 1 / pool.length;
        const next = (counts[id] ?? 0) + (proteinErr * share) / a.proteinG;
        counts[id] = proteinErr > 0 ? Math.min(Math.max(0, next), MAX_EXCHANGES_PER_GROUP) : Math.max(0, next);
      }
    }
  }

  // Medical-hold safety net: the loop above never RAISES whole-food protein
  // past the seed when held, but cereal/fruit grown to hit calories or carbs
  // can still push totals over the ceiling faster than the per-round
  // reduction above closes it within MAX_SOLVE_ROUNDS. Trim the residual
  // carb carriers directly rather than ship a plan that breaches a medical
  // hold — protein safety here outranks carb precision, the same ordering
  // roadmap.ts itself uses (protein and fat are requirements, carbs are what
  // is left over).
  if (proteinHeld) {
    const ceiling = target.proteinG * PROTEIN_HIGH_FRACTION;
    for (const leverId of ["cereals_starches", "fruit"] as const) {
      let totals = sumTotals(counts);
      while (totals.proteinG > ceiling && (counts[leverId] ?? 0) > 0) {
        counts[leverId] = Math.max(0, roundTo((counts[leverId] ?? 0) - EXCHANGE_STEP, EXCHANGE_STEP));
        totals = sumTotals(counts);
      }
    }
  }

  // Round to real portions, then recompute totals from the rounded counts —
  // the number the dietitian and client actually see must be the number the
  // totals below were summed from, not the fractional solve intermediate.
  for (const id of Object.keys(counts) as ExchangeGroupId[]) {
    const step = id === "fitty_protein" ? FITTY_STEP : EXCHANGE_STEP;
    const rounded = roundTo(counts[id]!, step);
    if (rounded <= 0) delete counts[id];
    else counts[id] = rounded;
  }

  let totals = sumTotals(counts);
  let fittyProteinUsed = false;

  // Gap-fill: whole food still short by more than the app's existing
  // protein-low tolerance. Medical hold overrides this exactly like
  // buildRoadmap() — no supplement, no raising the whole-food groups either,
  // the held number stands as the ceiling.
  const proteinGap = target.proteinG - totals.proteinG;
  if (proteinGap > PROTEIN_LOW_TOLERANCE_G) {
    if (proteinHeld) {
      warnings.push(
        `Protein held at ${totals.proteinG} g — ${proteinGap.toFixed(1)} g under the ${target.proteinG} g target, ` +
          `but a medical protein hold is set. Do not add Fitty Protein or raise whole-food exchanges.`
      );
    } else if (!groupAllowed("fitty_protein", dietType, jain)) {
      // Vegan: protein source unconfirmed, so Fitty is excluded the same as
      // any other unverified food — the gap is reported, not silently closed
      // with a supplement that hasn't been cleared for this diet type.
      warnings.push(
        `Protein ${totals.proteinG} g is ${proteinGap.toFixed(1)} g short of the ${target.proteinG} g target, and Fitty Protein is not confirmed vegan-safe — gap cannot be closed automatically.`
      );
    } else {
      const a = EXCHANGE_GROUPS.fitty_protein;
      const scoops = roundTo(proteinGap / a.proteinG, FITTY_STEP);
      if (scoops > 0) {
        counts.fitty_protein = (counts.fitty_protein ?? 0) + scoops;
        fittyProteinUsed = true;
        totals = sumTotals(counts);
      }
    }
  }

  const proteinLow = target.proteinG - PROTEIN_LOW_TOLERANCE_G;
  const proteinHigh = target.proteinG * PROTEIN_HIGH_FRACTION;
  const proteinWithinBand = totals.proteinG >= proteinLow && totals.proteinG <= proteinHigh;
  if (!proteinWithinBand) {
    warnings.push(
      totals.proteinG < proteinLow
        ? `Protein ${totals.proteinG} g is still ${(proteinLow - totals.proteinG).toFixed(1)} g under band after solving — the exchange list may not carry enough allowed protein sources for this target.`
        : proteinHeld
          ? `Medical protein hold: even after trimming carb-carrying exchanges, protein ${totals.proteinG} g is still over the ${proteinHigh.toFixed(1)} g band ceiling — this plan needs a dietitian's manual review, not automatic exchange selection.`
          : `Protein ${totals.proteinG} g is over the ${proteinHigh.toFixed(1)} g band ceiling.`
    );
  }

  const calorieLow = target.kcal * CALORIE_LOW_FRACTION;
  const calorieHigh = target.kcal * CALORIE_HIGH_FRACTION;
  const calorieWithinBand = totals.kcal >= calorieLow && totals.kcal <= calorieHigh;
  if (!calorieWithinBand) {
    warnings.push(
      `Calories ${totals.kcal} kcal fall outside the ${Math.round(calorieLow)}–${Math.round(calorieHigh)} kcal band around the ${target.kcal} kcal target.`
    );
  }

  if (totals.fiberG > target.fiberG * 1.5) {
    warnings.push(
      `Fibre ${totals.fiberG} g is well over the ${target.fiberG} g target (roadmap.ts has no fibre ramp yet — see ENGINE_VERSION notes) — flagged, not corrected here.`
    );
  }

  const exchanges: ExchangeCount[] = (Object.keys(counts) as ExchangeGroupId[])
    .filter((id) => (counts[id] ?? 0) > 0)
    .sort((a, b) => EXCHANGE_GROUPS[a].label.localeCompare(EXCHANGE_GROUPS[b].label))
    .map((id) => ({ groupId: id, label: EXCHANGE_GROUPS[id].label, count: counts[id]! }));

  return { exchanges, totals, target, proteinWithinBand, calorieWithinBand, fittyProteinUsed, warnings };
}

/**
 * The result as plain-language lines a generation prompt can drop in
 * verbatim — the day's exchange budget, with a few named foods per group so
 * the model anchors on foods the exchange list (and therefore grounding)
 * actually prices, instead of composing quantities from scratch.
 */
export function describeExchangePlan(result: ExchangePlanResult): string[] {
  const lines = result.exchanges.map((e) => {
    const examples = EXCHANGE_FOOD_EXAMPLES[e.groupId].join(", ");
    return `${e.count} exchange(s) of ${e.label} (e.g. ${examples})`;
  });
  if (result.fittyProteinUsed) {
    lines.push("Whole food alone cannot reach the protein target this week — Fitty Protein is included above; use it, do not substitute a different supplement.");
  }
  return lines;
}

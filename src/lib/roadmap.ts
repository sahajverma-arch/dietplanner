// The diet engine: BMI band, weight target, timeline, calories and macros.
//
// Implements "Diet Engine: Rationale & Standards Companion" v1.0 (July 2026),
// the Fitelo/Fitty nutrition standard. Every constant here traces to a
// published source through that document — ICMR-NIN 2020 and 2024, the Indian
// Consensus Group 2009 BMI cut-offs, WHO 2004, and the ISSN position stands.
//
// The engine COMPUTES; nothing here is a judgement call and nothing here is
// left to the model. The one judgement it cannot make is which of the four
// categories a client is in — "is this client stuck or restarting?" is a
// conversation, not a measurement — so that arrives as an explicit human input
// from the counselling, and everything downstream is mechanical.
//
// The category changes exactly two things: the calorie strategy and the
// protein band. BMI classification, target weight, timeline, fat, fibre and
// every guardrail run identically for all four. That restraint is from the
// spec and is deliberate — each extra branch is a path to test, explain and
// maintain.

/** Bumped whenever a constant below changes, and stored with each roadmap. */
export const ENGINE_VERSION = "1.0";

export type Category = 1 | 2 | 3 | 4;

export interface CategoryMeta {
  id: Category;
  /** What the dietitian picks in the counselling. */
  label: string;
  /** The client's actual problem, which is what the category is really naming. */
  constraint: string;
  proteinPerKg: number;
}

/**
 * Four different starting problems, not four different diets.
 *
 * A first-timer's constraint is habit formation, a plateaued client's is
 * diagnosis, a re-starter's is confidence, a maintainer's is not regaining.
 * Each needs a different opening move; none needs different physiology.
 */
export const CATEGORIES: CategoryMeta[] = [
  {
    id: 1,
    label: "First-timer — never dieted with structure before",
    constraint: "Habit formation",
    // A sedentary Indian adult eats roughly 0.6-0.9 g/kg. Going straight to
    // 1.9 is close to a threefold jump: GI distress, cost, and it displaces
    // vegetables from the plate. 1.35 is still well above the ICMR-NIN RDA.
    proteinPerKg: 1.35,
  },
  {
    id: 2,
    label: "Plateaued — dieting now, weight has stopped moving",
    constraint: "Diagnosis: adapted, or is the logging drifting?",
    proteinPerKg: 1.9,
  },
  {
    id: 3,
    label: "Re-starter — lost weight before and regained it",
    constraint: "Rebuilding confidence and adherence",
    proteinPerKg: 1.9,
  },
  {
    id: 4,
    label: "Maintenance — at or near goal, holding it",
    constraint: "Not regaining",
    // Eucaloric muscle support: no deficit to defend, but RDA-level intake
    // would under-serve someone training.
    proteinPerKg: 1.5,
  },
];

export const categoryMeta = (c: Category): CategoryMeta =>
  CATEGORIES.find((x) => x.id === c) ?? CATEGORIES[0];

// --- Step 1 constants -------------------------------------------------------

/**
 * Asian-Indian BMI cut-offs (Indian Consensus Group 2009), NOT the Western
 * 25/30. Indians develop cardiometabolic disease at a lower BMI, so overweight
 * starts at 23.
 */
export const BMI_NORMAL_LOW = 18.5;
export const BMI_OVERWEIGHT = 23.0;
export const BMI_OBESE = 25.0;
/**
 * The weight target sits at the MIDDLE of the healthy range, not its top.
 * A target at 22.9 has no buffer: ordinary 1-2 kg water swings would reclassify
 * the client as overweight on any bad week.
 */
export const BMI_TARGET = 21.0;
export const BMI_RANGE_HIGH = 22.9;

// --- Step 2 constants -------------------------------------------------------

/** Weekly loss as a share of body weight. Range, because a point estimate lies. */
export const RATE_FAST = 0.01;
export const RATE_SLOW = 0.005;

// --- Step 3 constants -------------------------------------------------------

/** First-timer deficit: the midpoint of the 15-20% band. */
export const DEFICIT_FIRST_TIMER = 0.175;
/** Category 3 ramps to here; Category 2 re-enters here after a diet break. */
export const DEFICIT_FULL = 0.2;
export const RESTART_RAMP = [0.1, 0.15, 0.2];
/**
 * Free-living intake varies by ±300-400 kcal without anyone noticing. A gap
 * smaller than that is inside the noise and needs no transition phase; a gap
 * larger than it is what registers as deprivation.
 */
export const TRANSITION_TRIGGER_KCAL = 400;
export const TRANSITION_WEEKS = 2;
/** Reverse diet: trigger gap, and the weekly step (~5% of TDEE). */
export const REVERSE_TRIGGER_KCAL = 300;
export const REVERSE_STEP_KCAL = 125;
/** Category 2 adaptation tests. */
export const ADAPT_DEFICIT_DEPTH = 0.25;
export const ADAPT_DEFICIT_WEEKS = 8;
export const ADAPT_STAGNANT_WEEKS = 3;
export const ADAPT_STAGNANT_INTAKE_SHARE = 0.85;
export const DIET_BREAK_DAYS = "10–14 days";
export const DIET_BREAK_STEPS = "1,500–2,000 extra steps a day";

// --- Step 4 constants -------------------------------------------------------

export const FAT_SHARE = 0.25;
/** Hormone floor: fat-soluble vitamins, essential fatty acids, steroid synthesis. */
export const FAT_FLOOR_PER_KG = 0.7;
/**
 * ICMR-NIN 2020: 30 g per 2,000 kcal — which is 15, not the 14 g/1,000 kcal US
 * Institute of Medicine figure the spec currently carries. §10.1 of the
 * companion recommends this correction, and since the stated position is that
 * fibre follows ICMR, the constant follows ICMR.
 */
export const FIBRE_PER_1000_KCAL = 15;
export const FIBRE_FLOOR_G = 30;
export const FIBRE_CAP_G = 45;
/** ICMR-NIN minimum carbohydrate. Checked, because carbs are the residual. */
export const CARB_FLOOR_G = 100;
/** Adjusted body weight is used for protein dosing at and above this BMI. */
export const ADJUSTED_WEIGHT_FROM_BMI = BMI_OBESE;
export const ADJUSTED_WEIGHT_FACTOR = 0.25;

// ---------------------------------------------------------------------------

export interface RoadmapInput {
  heightCm: number | null;
  weightKg: number | null;
  /** Mifflin-St Jeor, from the counselling. */
  bmr: number | null;
  /** BMR × activity, plus training. */
  tdee: number | null;
  /** What the client eats now, measured. Null when nothing was recorded. */
  currentKcal: number | null;
  category: Category | null;
  /** Category 2 only: weeks held at the current deficit. */
  weeksOnCurrentPlan?: number | null;
  /** Category 2 only: weeks the weight has not moved. */
  weeksStagnant?: number | null;
}

export interface CaloriePhase {
  label: string;
  kcal: number;
  /** What this phase is FOR — phases without this read as arbitrary. */
  note: string;
  /** First week this phase applies to (1-based). */
  fromWeek: number;
  /** Last week, or null for "and onward". */
  toWeek: number | null;
}

export interface RoadmapWarning {
  id: string;
  label: string;
  detail: string;
  /** True where the engine must not issue a prescription at all. */
  stop: boolean;
}

export interface Roadmap {
  version: string;
  category: CategoryMeta;
  bmi: number;
  band: string;
  /** BMI 21.0 × height² — the middle of the range, not its top. */
  targetWeightKg: number;
  healthyRangeKg: { low: number; high: number };
  weightToLoseKg: number;
  /** 5% of body weight: where measurable metabolic benefit begins (§10.8). */
  milestone5pctKg: number;
  timeline: { fastestWeeks: number; slowestWeeks: number } | null;
  /** The steady-state target, after the BMR clamp. */
  targetKcal: number;
  /** Every phase in order, including any transition or ramp. */
  phases: CaloriePhase[];
  /** Weight protein is dosed on, and whether it was adjusted. */
  dosingWeightKg: number;
  usedAdjustedWeight: boolean;
  macros: { protein_g: number; fat_g: number; carbs_g: number; fibre_g: number };
  /** What the coach has to be told before this plan is handed over. */
  warnings: RoadmapWarning[];
  /** Category 2's verdict, when it applies. */
  adaptation?: { adapted: boolean; reasons: string[]; action: string };
}

const round = (n: number) => Math.round(n);
const round1 = (n: number) => Math.round(n * 10) / 10;

/** The clinical band for a BMI, on Asian-Indian cut-offs. */
export function band(bmi: number): string {
  if (bmi < BMI_NORMAL_LOW) return "Underweight";
  if (bmi < BMI_OVERWEIGHT) return "Normal";
  if (bmi < BMI_OBESE) return "Overweight";
  return "Obese";
}

/** Everything the engine needs, or the list of what is still missing. */
export function roadmapMissing(input: RoadmapInput): string[] {
  const missing: string[] = [];
  if (!input.heightCm) missing.push("height");
  if (!input.weightKg) missing.push("weight");
  if (!input.bmr || !input.tdee) missing.push("BMR/TDEE (needs age and sex)");
  if (!input.category) missing.push("client category");
  return missing;
}

/**
 * The whole roadmap, or null when an input is missing.
 *
 * Returns rather than throws on the clinical stops (underweight, impossible
 * TDEE) — the caller shows them to the dietitian, who is the one who decides
 * what happens next. An engine that silently declines to answer is worse than
 * one that says why.
 */
export function buildRoadmap(input: RoadmapInput): Roadmap | null {
  const { heightCm, weightKg, bmr, tdee, category } = input;
  if (!heightCm || !weightKg || !bmr || !tdee || !category) return null;

  const meta = categoryMeta(category);
  const warnings: RoadmapWarning[] = [];

  const m = heightCm / 100;
  const bmi = weightKg / m ** 2;
  const bandName = band(bmi);

  // --- Step 1: target weight ------------------------------------------------
  const targetWeightKg = BMI_TARGET * m ** 2;
  const healthyRangeKg = { low: BMI_NORMAL_LOW * m ** 2, high: BMI_RANGE_HIGH * m ** 2 };
  const weightToLoseKg = Math.max(0, weightKg - targetWeightKg);

  // A weight-loss prescription for an underweight client is a foreseeable
  // harm, and a low BMI in someone presenting for weight loss is a signal that
  // needs a person, not a plan.
  if (bmi < BMI_NORMAL_LOW) {
    warnings.push({
      id: "underweight",
      label: "Underweight — do not issue a weight-loss plan",
      detail: `BMI ${round1(bmi)} is below ${BMI_NORMAL_LOW}. Route to a senior dietitian before any plan is generated.`,
      stop: true,
    });
  }

  // Physiologically impossible, so it is a typo in the activity level — and a
  // confident, well-formatted, entirely wrong prescription is the most
  // dangerous kind of software error, because nothing about it looks wrong.
  if (tdee < bmr) {
    warnings.push({
      id: "tdee-below-bmr",
      label: "TDEE below BMR — check the activity level",
      detail: `TDEE ${tdee} is below BMR ${bmr}, which cannot happen. The activity multiplier is wrong.`,
      stop: true,
    });
  }

  // --- Step 2: timeline -----------------------------------------------------
  const timeline =
    weightToLoseKg > 0
      ? {
          fastestWeeks: Math.ceil(weightToLoseKg / (weightKg * RATE_FAST)),
          slowestWeeks: Math.ceil(weightToLoseKg / (weightKg * RATE_SLOW)),
        }
      : null;

  // --- Step 3: calories -----------------------------------------------------
  const { targetKcal, phases, adaptation } = calorieStrategy(input, bmr, tdee, warnings);

  // --- Step 4: macros -------------------------------------------------------
  // Adipose tissue is far less protein-demanding than lean tissue, so a heavy
  // client dosed on total weight gets a number that is unnecessary, expensive
  // and hard to eat. 0.25 is a clinical-nutrition convention used precisely
  // when lean mass is unknown — it is not a measurement, and once body fat is
  // captured this should dose on lean body mass instead.
  const usedAdjustedWeight = bmi >= ADJUSTED_WEIGHT_FROM_BMI;
  const dosingWeightKg = usedAdjustedWeight
    ? targetWeightKg + ADJUSTED_WEIGHT_FACTOR * (weightKg - targetWeightKg)
    : weightKg;

  const protein_g = round(meta.proteinPerKg * dosingWeightKg);

  // The floor overrides the percentage, because a percentage-based allocation
  // collapses at low calorie targets — and it is dosed on ACTUAL weight, since
  // the hormone requirement does not shrink with an adjustment convention.
  const fatFromShare = (targetKcal * FAT_SHARE) / 9;
  const fatFloor = FAT_FLOOR_PER_KG * weightKg;
  const fat_g = round(Math.max(fatFromShare, fatFloor));

  // Carbohydrate is the residual: protein and fat are requirements, carbs are
  // what is left to spend on energy.
  const carbs_g = Math.max(0, round((targetKcal - protein_g * 4 - fat_g * 9) / 4));

  const fibre_g = Math.min(
    FIBRE_CAP_G,
    Math.max(FIBRE_FLOOR_G, round((targetKcal / 1000) * FIBRE_PER_1000_KCAL))
  );

  if (carbs_g < CARB_FLOOR_G) {
    warnings.push({
      id: "carb-floor",
      label: "Carbohydrate below the ICMR-NIN minimum",
      detail: `${carbs_g} g is under the ${CARB_FLOOR_G} g/day floor. Raise the calorie target or lower the protein band.`,
      stop: false,
    });
  }

  if (fatFloor > fatFromShare) {
    warnings.push({
      id: "fat-floor",
      label: "Fat set by the hormone floor, not the percentage",
      detail: `${FAT_FLOOR_PER_KG} g/kg gives ${round(fatFloor)} g, above the ${round(fatFromShare)} g that ${Math.round(FAT_SHARE * 100)}% of calories would allow.`,
      stop: false,
    });
  }

  return {
    version: ENGINE_VERSION,
    category: meta,
    bmi: round1(bmi),
    band: bandName,
    targetWeightKg: round1(targetWeightKg),
    healthyRangeKg: { low: round1(healthyRangeKg.low), high: round1(healthyRangeKg.high) },
    weightToLoseKg: round1(weightToLoseKg),
    milestone5pctKg: round1(weightKg * 0.05),
    timeline,
    targetKcal,
    phases,
    dosingWeightKg: round1(dosingWeightKg),
    usedAdjustedWeight,
    macros: { protein_g, fat_g, carbs_g, fibre_g },
    warnings,
    ...(adaptation ? { adaptation } : {}),
  };
}

// ---------------------------------------------------------------------------

function calorieStrategy(
  input: RoadmapInput,
  bmr: number,
  tdee: number,
  warnings: RoadmapWarning[]
): { targetKcal: number; phases: CaloriePhase[]; adaptation?: Roadmap["adaptation"] } {
  const { category, currentKcal } = input;

  // Raised for every category, not just Category 2: a first-timer or a
  // re-starter can arrive already eating below their resting requirement
  // without anyone having classified them as plateaued.
  if (currentKcal !== null && currentKcal > 0 && currentKcal < bmr) {
    warnings.push({
      id: "chronic-under-eating",
      label: "Reported intake is below BMR",
      detail: `${currentKcal} kcal against a BMR of ${bmr}. Either real adaptation or substantial under-reporting — both mean stop cutting and measure before prescribing.`,
      stop: false,
    });
  }

  /** No target ever goes below resting requirement. */
  const clamp = (kcal: number, label: string): number => {
    if (kcal >= bmr) return round(kcal);
    warnings.push({
      id: "bmr-floor",
      label: "Calorie target clamped to BMR",
      detail: `${label} computed ${round(kcal)} kcal, below the ${bmr} kcal resting requirement. Held at BMR — this client's goal and their metabolic room are in tension, so slow the timeline rather than cut further.`,
      stop: false,
    });
    return bmr;
  };

  if (category === 4) {
    // Maintenance sometimes means eating MORE: a client arriving from a long
    // deficit is often well below their TDEE, and going straight to it is the
    // thing that frightens them off.
    const gap = currentKcal !== null && currentKcal > 0 ? tdee - currentKcal : 0;
    const target = clamp(tdee, "Maintenance");
    if (gap > REVERSE_TRIGGER_KCAL) {
      const steps = Math.ceil(gap / REVERSE_STEP_KCAL);
      const phases: CaloriePhase[] = [];
      for (let i = 1; i <= steps; i++) {
        phases.push({
          label: `Week ${i}`,
          fromWeek: i,
          toWeek: i === steps ? null : i,
          kcal: Math.min(target, round(currentKcal! + i * REVERSE_STEP_KCAL)),
          note:
            i === 1
              ? `Reverse diet: +${REVERSE_STEP_KCAL} kcal a week, small enough to stay under the scale's noise floor.`
              : `+${REVERSE_STEP_KCAL} kcal`,
        });
      }
      return { targetKcal: target, phases };
    }
    return {
      targetKcal: target,
      phases: [
        {
          label: "Ongoing",
          fromWeek: 1,
          toWeek: null,
          kcal: target,
          note:
            gap > 0
              ? "Within normal daily variation of maintenance — eat to appetite, no protocol needed."
              : "Maintenance at TDEE.",
        },
      ],
    };
  }

  if (category === 2) {
    const adaptation = adaptationVerdict(input, bmr, tdee);
    if (adaptation.adapted) {
      const reentry = clamp(tdee * (1 - DEFICIT_FULL), "Re-entry deficit");
      return {
        targetKcal: reentry,
        adaptation,
        phases: [
          {
            label: `Diet break (${DIET_BREAK_DAYS})`,
            fromWeek: 1,
            toWeek: 2,
            kcal: clamp(tdee, "Diet break"),
            note: `Eat at TDEE; the extra calories go to carbohydrate specifically, and add ${DIET_BREAK_STEPS}. Warn the client first: the scale will rise 1–2 kg as glycogen refills, and each gram of it holds about three grams of water.`,
          },
          {
            label: "Then",
            fromWeek: 3,
            toWeek: null,
            kcal: reentry,
            note: `Re-enter at ${Math.round(DEFICIT_FULL * 100)}%, not at the previous deficit — the previous deficit is what produced the adaptation.`,
          },
        ],
      };
    }
    // Not adapted: the deficit is not as deep as the numbers claim, and cutting
    // on top of bad data creates a real deficit far larger than intended.
    const held = clamp(tdee * (1 - DEFICIT_FULL), "Held target");
    return {
      targetKcal: held,
      adaptation,
      phases: [
        {
          label: "14 days, no change to the target",
          fromWeek: 1,
          toWeek: null,
          kcal: held,
          note: "Weighed logging for two weeks — weighed, not estimated, because the error being hunted is exactly the one estimation produces: cooking oil, portion size, unlogged tastings. Fix the measurement before touching the prescription.",
        },
      ],
    };
  }

  if (category === 3) {
    // The client never resumes the old plan, because the old plan already
    // failed once. Each step is ~5% of TDEE, below the threshold at which a
    // change in intake is consciously felt.
    const phases: CaloriePhase[] = RESTART_RAMP.map((deficit, i) => ({
      label: i === RESTART_RAMP.length - 1 ? `Week ${i + 1} onward` : `Week ${i + 1}`,
      fromWeek: i + 1,
      toWeek: i === RESTART_RAMP.length - 1 ? null : i + 1,
      kcal: clamp(tdee * (1 - deficit), `Ramp step ${i + 1}`),
      note:
        i === 0
          ? "A real but nearly painless deficit. Its purpose is data and rhythm, not loss."
          : `Progression is gated on behaviour — 6 of 7 days logged — never on the scale, which is contaminated by water, salt and cycle.`,
    }));
    return { targetKcal: phases[phases.length - 1].kcal, phases };
  }

  // Category 1.
  const target = clamp(tdee * (1 - DEFICIT_FIRST_TIMER), "First-timer target");
  const gap = currentKcal !== null && currentKcal > 0 ? currentKcal - target : 0;

  // §10.6: the transition rule only fires on a positive gap. A first-timer
  // already eating below their computed target must not silently receive an
  // unexplained instruction to eat more.
  if (currentKcal !== null && currentKcal > 0 && gap < 0) {
    warnings.push({
      id: "already-below-target",
      label: "Client already eats below the computed target",
      detail: `${currentKcal} kcal now versus a ${target} kcal target. Do not prescribe an increase without explaining it — check the recorded intake first.`,
      stop: false,
    });
  }

  if (gap > TRANSITION_TRIGGER_KCAL) {
    const transition = round((currentKcal! + target) / 2);
    return {
      targetKcal: target,
      phases: [
        {
          label: `Weeks 1–${TRANSITION_WEEKS}`,
          fromWeek: 1,
          toWeek: TRANSITION_WEEKS,
          kcal: transition,
          note:
            "Transition, not a deficit — this phase exists to stop the gain, change the food structure and build the logging habit while hunger is still near zero. Tell the client the scale will barely move; otherwise they conclude on day 14 that the plan does not work, two weeks before it has started.",
        },
        {
          label: `Week ${TRANSITION_WEEKS + 1} onward`,
          fromWeek: TRANSITION_WEEKS + 1,
          toWeek: null,
          kcal: target,
          note: `The full ${Math.round(DEFICIT_FIRST_TIMER * 100)}% deficit, landing on a client who already has the habits in place.`,
        },
      ],
    };
  }

  return {
    targetKcal: target,
    phases: [
      {
        label: "From week 1",
        fromWeek: 1,
        toWeek: null,
        kcal: target,
        note: `${Math.round(DEFICIT_FIRST_TIMER * 100)}% below TDEE — the midpoint of the 15–20% band. The gap from current intake is inside normal daily variation, so no transition phase is needed.`,
      },
    ],
  };
}

/**
 * Category 2's diagnosis: genuinely adapted, or is reported intake drifting?
 *
 * The two answers require opposite actions — eat more versus measure better —
 * so guessing is expensive. Any one test firing is enough.
 */
function adaptationVerdict(
  input: RoadmapInput,
  bmr: number,
  tdee: number
): { adapted: boolean; reasons: string[]; action: string } {
  const reasons: string[] = [];
  const { currentKcal, weeksOnCurrentPlan, weeksStagnant } = input;

  if (currentKcal !== null && currentKcal > 0 && currentKcal < bmr) {
    reasons.push(
      `Eating ${currentKcal} kcal, below the ${bmr} kcal resting requirement. Real adaptation or substantial under-reporting — cutting further is the wrong answer to both.`
    );
  }

  const deficitShare = currentKcal !== null && currentKcal > 0 ? 1 - currentKcal / tdee : 0;
  if (deficitShare > ADAPT_DEFICIT_DEPTH && (weeksOnCurrentPlan ?? 0) > ADAPT_DEFICIT_WEEKS) {
    reasons.push(
      `A ${Math.round(deficitShare * 100)}% deficit held ${weeksOnCurrentPlan} weeks. Adaptation is depth × duration, and past 8 weeks the drop in resting expenditure becomes measurable rather than theoretical.`
    );
  }

  if (
    (weeksStagnant ?? 0) >= ADAPT_STAGNANT_WEEKS &&
    currentKcal !== null &&
    currentKcal > 0 &&
    currentKcal <= tdee * ADAPT_STAGNANT_INTAKE_SHARE
  ) {
    reasons.push(
      `Weight flat ${weeksStagnant} weeks while eating at or under ${Math.round(ADAPT_STAGNANT_INTAKE_SHARE * 100)}% of TDEE. The arithmetic says deficit, the scale says otherwise — something in the model is wrong.`
    );
  }

  return {
    adapted: reasons.length > 0,
    reasons,
    action: reasons.length
      ? "Diet break at TDEE, extra calories into carbohydrate, more steps — then re-enter at 20%."
      : "No adaptation test fired: fix the measurement before touching the prescription. 14 days of weighed logging.",
  };
}

/**
 * The phase a given week falls in, and the macros to build that week to.
 *
 * Protein and fat do NOT scale with the phase: they are requirements, computed
 * once at the steady-state target. A transition or diet-break week is carrying
 * extra ENERGY, and the spec is explicit about where extra energy goes — into
 * carbohydrate, which is what refills glycogen and what the hormonal response
 * is most sensitive to. So carbohydrate absorbs the difference and the residual
 * is recomputed for the week actually being planned.
 */
export function weekTargets(
  roadmap: Roadmap,
  week: number
): { phase: CaloriePhase; kcal: number; protein_g: number; fat_g: number; carbs_g: number } {
  const phase =
    roadmap.phases.find((p) => week >= p.fromWeek && (p.toWeek === null || week <= p.toWeek)) ??
    roadmap.phases[roadmap.phases.length - 1];
  const { protein_g, fat_g } = roadmap.macros;
  const carbs_g = Math.max(0, Math.round((phase.kcal - protein_g * 4 - fat_g * 9) / 4));
  return { phase, kcal: phase.kcal, protein_g, fat_g, carbs_g };
}

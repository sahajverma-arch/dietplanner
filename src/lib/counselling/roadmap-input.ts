// Wires the counselling to the diet engine.
//
// Kept apart from roadmap.ts on purpose: the engine is pure arithmetic over
// numbers and must stay testable without a counselling form anywhere near it,
// and questions.ts already imports the engine for its category list, so the
// engine importing the answers back would be a cycle.
//
// Everything the engine needs, this counselling already measures — height and
// weight from Q7, BMR and TDEE from the Mifflin-St Jeor estimate, and current
// intake from the recorded meals and drinks. Only the category is new, because
// it is the one input that is a judgement rather than a measurement.

import { energyEstimate } from "./energy";
import { roadmapCategory, ROADMAP_WEEKS_ON_PLAN_ID, ROADMAP_WEEKS_STAGNANT_ID, val, type Answers } from "./questions";
import { estimateProteinIntake, medicalProteinCap } from "../protein-intake";
import {
  buildRoadmap,
  roadmapMissing,
  type Category,
  type Roadmap,
  type RoadmapInput,
} from "../roadmap";

const num = (a: Answers, id: string): number | null => {
  const n = Number(val(a, id));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * A weight recorded after the counselling — the follow-up figure for the week
 * being planned.
 *
 * Every number the engine produces is downstream of weight: BMR, TDEE, the
 * deficit taken off it, the target weight, the timeline, and the weight protein
 * is dosed on. Computing them from the counselling forever means the
 * prescription decays as the client succeeds — a client who has lost 10 kg is
 * eating a target set for the 10 kg they no longer carry, so a deficit written
 * as 17.5% is really about 12%, and by goal weight it is 6%. The weight loss
 * stalls, and the next counselling classifies them "plateaued" for it.
 */
export interface RoadmapAsOf {
  weightKg?: number | null;
  /**
   * Override the counselling's category. Only for projecting a state the client
   * is not in yet — never for a plan being generated, where the category is the
   * dietitian's recorded judgement and not something code may revise.
   */
  category?: Category;
}

export function roadmapInput(a: Answers, asOf?: RoadmapAsOf): RoadmapInput {
  // Overridden on a copy rather than plumbed through every derivation: BMR,
  // TDEE, BMI and the protein-per-kg figure each read the weight answer
  // themselves, and one of them silently keeping the old value is exactly the
  // half-updated prescription this is meant to prevent.
  const answers: Answers =
    asOf?.weightKg && asOf.weightKg > 0 ? { ...a, q9_weight: String(asOf.weightKg) } : a;

  const energy = energyEstimate(answers);
  const intake = estimateProteinIntake(answers);
  return {
    heightCm: num(answers, "q9_height"),
    weightKg: num(answers, "q9_weight"),
    bmr: energy.bmr,
    tdee: energy.tdee,
    // Zero means "nothing recorded", not "eats nothing" — the engine must not
    // read an unfilled form as a client on a starvation diet.
    currentKcal: intake.kcalPerDay > 0 ? intake.kcalPerDay : null,
    currentProteinG: intake.gramsPerDay,
    currentCarbsG: intake.carbsPerDay,
    currentFatG: intake.fatPerDay,
    category: asOf?.category ?? roadmapCategory(a),
    weeksOnCurrentPlan: num(a, ROADMAP_WEEKS_ON_PLAN_ID),
    weeksStagnant: num(a, ROADMAP_WEEKS_STAGNANT_ID),
    // Until the engine's protein ladder existed this check guarded only the
    // legacy measured-intake path, so a renal client WITH a category recorded
    // bypassed it entirely and was dosed straight off the g/kg band.
    proteinCapReason: medicalProteinCap(a),
  };
}

/**
 * The roadmap for this counselling, or null while an input is still missing.
 *
 * `asOf` re-bases it on a weight recorded later. Without it the roadmap is the
 * counselling-day one, which is right for the review page and week 1 and wrong
 * for every week after that.
 */
export const roadmapFor = (a: Answers, asOf?: RoadmapAsOf): Roadmap | null =>
  buildRoadmap(roadmapInput(a, asOf));

/** What is still needed before a roadmap can be computed. */
export const roadmapNeeds = (a: Answers): string[] => roadmapMissing(roadmapInput(a));

/**
 * The end of the journey: the client at their target weight.
 *
 * The four weekly blocks answer "what do I eat on Monday". This answers the
 * question a client asks straight after — "and when I get there, then what?" —
 * which was previously unanswerable anywhere in the app, because every number
 * was computed from the weight they walked in with.
 *
 * TWO THINGS ARE DELIBERATE HERE, and both are judgement calls worth knowing
 * about:
 *
 *  - It is computed as MAINTENANCE, not as the client's own category. At BMI 21
 *    there is nothing left to lose, so running their 17.5% deficit at goal
 *    weight would prescribe continued loss into underweight. Category 4 exists
 *    in the engine for exactly this state — "at or near goal, holding it" — so
 *    the projection uses it rather than inventing a fifth rule.
 *  - It is a PROJECTION, not a scheduled phase. Nothing switches the client to
 *    it automatically; the plan runs on its own numbers until a dietitian
 *    re-counsels. It is shown so the conversation can happen, not so it can be
 *    skipped.
 *
 * Null where there is no journey to project — a client already at or below
 * target weight, or a roadmap that cannot be built at all.
 */
export function roadmapAtGoal(a: Answers, base?: Roadmap | null): Roadmap | null {
  const from = base ?? roadmapFor(a);
  if (!from || from.weightToLoseKg <= 0) return null;
  return roadmapFor(a, { weightKg: from.targetWeightKg, category: 4 });
}

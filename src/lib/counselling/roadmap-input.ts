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
import { estimateProteinIntake } from "../protein-intake";
import { buildRoadmap, roadmapMissing, type Roadmap, type RoadmapInput } from "../roadmap";

const num = (a: Answers, id: string): number | null => {
  const n = Number(val(a, id));
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function roadmapInput(a: Answers): RoadmapInput {
  const energy = energyEstimate(a);
  const intake = estimateProteinIntake(a);
  return {
    heightCm: num(a, "q9_height"),
    weightKg: num(a, "q9_weight"),
    bmr: energy.bmr,
    tdee: energy.tdee,
    // Zero means "nothing recorded", not "eats nothing" — the engine must not
    // read an unfilled form as a client on a starvation diet.
    currentKcal: intake.kcalPerDay > 0 ? intake.kcalPerDay : null,
    currentProteinG: intake.gramsPerDay,
    currentCarbsG: intake.carbsPerDay,
    currentFatG: intake.fatPerDay,
    category: roadmapCategory(a),
    weeksOnCurrentPlan: num(a, ROADMAP_WEEKS_ON_PLAN_ID),
    weeksStagnant: num(a, ROADMAP_WEEKS_STAGNANT_ID),
  };
}

/** The roadmap for this counselling, or null while an input is still missing. */
export const roadmapFor = (a: Answers): Roadmap | null => buildRoadmap(roadmapInput(a));

/** What is still needed before a roadmap can be computed. */
export const roadmapNeeds = (a: Answers): string[] => roadmapMissing(roadmapInput(a));

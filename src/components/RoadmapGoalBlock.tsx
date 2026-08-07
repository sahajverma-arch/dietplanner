import type { Roadmap } from "@/lib/roadmap";

/**
 * The end of the journey: the client at target weight, and what they eat then.
 *
 * Shared by the review panel and the roadmap popup, because two copies of a
 * clinical explanation is two chances for them to disagree in front of a
 * client.
 *
 * The block has to do more than print numbers. At goal weight the energy figure
 * is usually HIGHER than the deficit target the client is on — Priya eats 1,669
 * kcal while losing and 1,750 kcal once she arrives — and read cold that looks
 * like a bug. It is the ordinary arithmetic of ending a diet: being 20 kg
 * lighter lowers her daily need by 273 kcal, but the 354 kcal deficit
 * disappears entirely, and the deficit is the larger of the two. A dietitian
 * asked "why do I eat more when I'm thinner" needs that sentence to hand, so
 * the block shows the working rather than only the result.
 */
export default function RoadmapGoalBlock({
  roadmap,
  atGoal,
}: {
  roadmap: Roadmap;
  atGoal: Roadmap | null;
}) {
  if (!atGoal) return null;

  // A Category 4 client's own roadmap already IS this projection — there is
  // no lower "goal weight" a reverse diet is aiming at, so none of the
  // "why did the number change" reconciliation below applies (nothing
  // changes: same weight, same numbers). Shown as an arrival, not a forecast.
  if (roadmap.category.id === 4) {
    const g = atGoal.macros;
    return (
      <div className="mt-3 rounded-lg border border-brand/40 bg-brand/5 px-3 py-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            At maintenance — current weight
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-wide text-brand">
            arrived, not projected
          </span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold tabular-nums">{atGoal.weightKg}</span>
            <span className="text-[11px] text-zinc-500">kg · current</span>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold tabular-nums">{atGoal.targetKcal}</span>
            <span className="text-[11px] text-zinc-500">kcal · eating to maintain</span>
          </span>
          <span className="flex flex-wrap gap-3 text-[11px] tabular-nums text-zinc-400">
            <span>
              <span className="text-zinc-500">P</span> {g.protein_g} g
            </span>
            <span>
              <span className="text-zinc-500">C</span> {g.carbs_g} g
            </span>
            <span>
              <span className="text-zinc-500">F</span> {g.fat_g} g
            </span>
            <span>
              <span className="text-zinc-500">Fibre</span> {g.fibre_g} g
            </span>
          </span>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
          A reverse diet targets maintenance at the weight this client is already at, not a lower
          "goal" weight — there is nothing left to project. This is the arrived-at prescription for{" "}
          {atGoal.weightKg} kg.
        </p>
      </div>
    );
  }

  if (!roadmap.timeline) return null;

  const { fastestWeeks, slowestWeeks } = roadmap.timeline;
  const g = atGoal.macros;
  const deficitNow = roadmap.tdee - roadmap.targetKcal;
  const needDrop = roadmap.tdee - atGoal.tdee;
  const change = atGoal.targetKcal - roadmap.targetKcal;

  return (
    <div className="mt-3">
      {/* The connector, sitting under the fourth week on a wide screen. */}
      <div className="grid grid-cols-2 sm:grid-cols-4" aria-hidden="true">
        <div className="hidden sm:block" />
        <div className="hidden sm:block" />
        <div className="hidden sm:block" />
        <div className="col-span-2 flex justify-center sm:col-span-1">
          <svg width="20" height="24" viewBox="0 0 20 24" className="text-brand">
            <path
              d="M10 0 V 15"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              fill="none"
            />
            <path d="M10 23 L 5 15 H 15 Z" fill="currentColor" />
          </svg>
        </div>
      </div>

      <div className="rounded-lg border border-brand/40 bg-brand/5 px-3 py-2.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            Week {fastestWeeks}–{slowestWeeks} — at the target weight
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-wide text-brand">
            projection
          </span>
        </div>

        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold tabular-nums">{roadmap.targetWeightKg}</span>
            <span className="text-[11px] text-zinc-500">kg · BMI 21</span>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold tabular-nums">{atGoal.targetKcal}</span>
            <span className="text-[11px] text-zinc-500">kcal · eating to maintain</span>
          </span>
          <span className="flex flex-wrap gap-3 text-[11px] tabular-nums text-zinc-400">
            <span>
              <span className="text-zinc-500">P</span> {g.protein_g} g
            </span>
            <span>
              <span className="text-zinc-500">C</span> {g.carbs_g} g
            </span>
            <span>
              <span className="text-zinc-500">F</span> {g.fat_g} g
            </span>
            <span>
              <span className="text-zinc-500">Fibre</span> {g.fibre_g} g
            </span>
          </span>
        </div>

        {/* Why the figure moved the way it did — the part that otherwise reads
            as an error. Only shown when the client is actually in a deficit
            now; for someone already at maintenance there is nothing to
            reconcile. */}
        {deficitNow > 0 && (
          <p className="mt-2 rounded bg-zinc-900/60 px-2.5 py-2 text-[11px] leading-relaxed text-zinc-400">
            <strong className="text-zinc-200">
              {change > 0
                ? `${change} kcal MORE than the ${roadmap.targetKcal} she eats while losing`
                : change < 0
                  ? `${Math.abs(change)} kcal less than the ${roadmap.targetKcal} she eats while losing`
                  : `the same figure she eats while losing`}
            </strong>{" "}
            — and that is not an error. Being {roadmap.weightToLoseKg} kg lighter lowers her daily
            need by {needDrop} kcal, but the {deficitNow} kcal deficit comes off altogether
            {change > 0
              ? ", and the deficit is the larger of the two. Eating more at a lower weight is what finishing a diet looks like."
              : "."}
          </p>
        )}

        <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
          At {roadmap.targetWeightKg} kg the problem changes from losing to not regaining, so this is
          the daily need for that weight — {atGoal.tdee} kcal, protein{" "}
          {atGoal.category.proteinPerKg} g/kg — rather than the deficit carried forward, which at BMI
          21 would go on driving weight down. Nothing switches the client across automatically:
          re-counsel when they arrive.
        </p>

        {/* The protein figure here will not match the one in "Macros while
            losing", and the difference is not obvious: the band changes with the
            category AND the dosing basis changes when BMI crosses 25. Two
            unexplained protein numbers on one screen is what this spells out. */}
        {atGoal.macros.protein_g !== roadmap.macros.protein_g && (
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
            <strong className="text-zinc-300">
              Protein reads {atGoal.macros.protein_g} g here, not the {roadmap.macros.protein_g} g
              shown for the losing phase
            </strong>{" "}
            — two things move at once. The band goes {roadmap.category.proteinPerKg} →{" "}
            {atGoal.category.proteinPerKg} g/kg with the change of category, and
            {roadmap.usedAdjustedWeight && !atGoal.usedAdjustedWeight
              ? ` dosing switches from ${roadmap.dosingWeightKg} kg adjusted body weight to the actual ${atGoal.dosingWeightKg} kg, because BMI is no longer 25 or above.`
              : ` dosing weight goes ${roadmap.dosingWeightKg} → ${atGoal.dosingWeightKg} kg.`}
          </p>
        )}
      </div>
    </div>
  );
}

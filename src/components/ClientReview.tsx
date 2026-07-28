"use client";

import { energyEstimate, bmiBand } from "@/lib/counselling/energy";
import { estimateProteinIntake, proteinTarget } from "@/lib/protein-intake";
import { fitnessAssessment, fitnessBand } from "@/lib/counselling/fitness-assessment";
import type { Answers } from "@/lib/counselling/questions";

/**
 * The conversation that closes the consultation.
 *
 * Everything the counselling measured, in front of the client, before a plan
 * exists: what they weigh, what their body needs at rest and in a day, what
 * they eat now and what week 1 is aiming at. The dietitian talks through this
 * and only then generates.
 *
 * Deliberately shows its working — the multiplier behind TDEE, the measured
 * intake behind the target — because a number a client cannot interrogate is a
 * number they will not act on.
 */

// Dumbbell marks: one accent + de-emphasis gray (the "emphasis" form). Identity
// is carried by position and a direct label on both ends, never colour alone,
// and both clear 3:1 on the zinc-900 surface with CVD separation ΔE 30+.
const NOW = "#a1a1aa";
const PLAN = "#E0D000";

export default function ClientReview({
  answers,
  planKcal,
  onGenerate,
  generating,
  disabled,
}: {
  answers: Answers;
  /** The calorie figure the plan will aim at, if the dietitian has set one. */
  planKcal?: number | null;
  onGenerate: () => void;
  generating: boolean;
  disabled: boolean;
}) {
  const energy = energyEstimate(answers);
  const intake = estimateProteinIntake(answers);
  const target = proteinTarget(answers, intake);
  const fitness = fitnessAssessment(answers);

  // The plan's calorie aim: what the dietitian set, else maintenance.
  const plannedKcal = planKcal ?? energy.tdee;

  const rows: { label: string; now: number; plan: number; unit: string }[] = [];
  if (intake.kcalPerDay > 0 && plannedKcal)
    rows.push({ label: "Energy", now: intake.kcalPerDay, plan: plannedKcal, unit: "kcal" });
  if (intake.gramsPerDay > 0 && target.targetG > 0)
    rows.push({ label: "Protein", now: intake.gramsPerDay, plan: target.targetG, unit: "g" });

  return (
    <div className="card mt-4 border border-brand/30 bg-brand/5">
      <h2 className="text-base font-semibold">Where {clientName(answers)} is today</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Talk this through with the client before generating. Every number here came from the
        counselling you just recorded.
      </p>

      {/* KPI row — single values, so stat tiles rather than a chart. */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="BMI"
          value={energy.bmi ? energy.bmi.toFixed(1) : "—"}
          sub={energy.bmi ? bmiBand(energy.bmi) : "needs height & weight"}
        />
        <Stat
          label="BMR (at rest)"
          value={energy.bmr ? String(energy.bmr) : "—"}
          sub={energy.bmr ? "kcal/day" : `needs ${energy.missing.join(", ")}`}
        />
        <Stat
          label="TDEE (whole day)"
          value={energy.tdee ? String(energy.tdee) : "—"}
          sub={
            energy.activityFactor
              ? `x${energy.activityFactor} activity${energy.trainingDays ? ` · ${energy.trainingDays} training days` : ""}`
              : "needs the above"
          }
        />
        <Stat
          label="Eats now"
          value={intake.kcalPerDay > 0 ? String(intake.kcalPerDay) : "—"}
          sub={intake.kcalPerDay > 0 ? "kcal/day measured" : "record the meals"}
        />
      </div>

      {/* Before -> after per item: the dumbbell form. */}
      {rows.length > 0 && (
        <div className="mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">Now, and what week 1 aims at</h3>
            <Legend />
          </div>
          <div className="mt-3 space-y-4">
            {rows.map((r) => (
              <Dumbbell key={r.label} {...r} />
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
            The protein target is the client&apos;s own measured intake raised {"~"}13%, so week 1
            is a step they can keep rather than a jump they abandon.
            {energy.tdee && intake.kcalPerDay > 0 && (
              <>
                {" "}
                They currently eat {intake.kcalPerDay} kcal against an estimated{" "}
                {energy.tdee} kcal daily need
                {intake.kcalPerDay < energy.tdee * 0.8 && " — a gap worth discussing before it is trusted"}
                .
              </>
            )}
          </p>
        </div>
      )}

      {fitness.recorded && (
        <p className="mt-4 rounded-lg bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400">
          Physical assessment: <strong className="text-zinc-200">{fitness.total}/{fitness.possible}</strong>
          {fitnessBand(fitness) ? ` · ${fitnessBand(fitness)}` : ` · ${fitness.completed} of 6 tests`}
        </p>
      )}

      {energy.missing.length > 0 && (
        <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          BMR and TDEE need {energy.missing.join(", ")} — fill those in and these figures appear.
          The plan can still be generated without them.
        </p>
      )}

      <button
        type="button"
        onClick={onGenerate}
        disabled={disabled || generating}
        className="btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-40"
      >
        {generating ? "Generating preview…" : "Generate Week 1 Diet Preview"}
      </button>
    </div>
  );
}

const clientName = (a: Answers): string => {
  const n = a["name"];
  const first = typeof n === "string" ? n.trim().split(/\s+/)[0] : "";
  return first || "this client";
};

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg bg-zinc-900/60 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[11px] text-zinc-500">{sub}</div>
    </div>
  );
}

function Legend() {
  return (
    <span className="flex items-center gap-3 text-[11px] text-zinc-400">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: NOW }} />
        eats now
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: PLAN }} />
        week-1 aim
      </span>
    </span>
  );
}

/**
 * One before -> after pair. The connecting line carries the size of the change,
 * the two dots carry the values, and both are labelled — so the chart is
 * readable without relying on the colours at all.
 */
function Dumbbell({
  label,
  now,
  plan,
  unit,
}: {
  label: string;
  now: number;
  plan: number;
  unit: string;
}) {
  const max = Math.max(now, plan) * 1.15;
  const pct = (v: number) => Math.max(2, (v / max) * 100);
  const [lo, hi] = now <= plan ? [now, plan] : [plan, now];
  const delta = Math.round(plan - now);

  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-zinc-300">{label}</span>
        <span className="tabular-nums text-zinc-500">
          {delta === 0 ? "no change" : `${delta > 0 ? "+" : "−"}${Math.abs(delta)} ${unit}`}
        </span>
      </div>
      <div className="relative mt-2 h-6">
        {/* Hairline track, one step off the surface. */}
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-zinc-800" />
        {/* The change itself. */}
        <div
          className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full"
          style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%`, background: PLAN }}
        />
        {[
          { v: now, c: NOW },
          { v: plan, c: PLAN },
        ].map(({ v, c }) => (
          <span
            key={c}
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
            // 2px surface ring so the dots stay legible where they overlap.
            style={{ left: `${pct(v)}%`, background: c, boxShadow: "0 0 0 2px #18181b" }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] tabular-nums">
        <span style={{ color: NOW }}>
          {now} {unit}
        </span>
        <span style={{ color: PLAN }}>
          {plan} {unit}
        </span>
      </div>
    </div>
  );
}

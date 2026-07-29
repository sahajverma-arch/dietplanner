"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { audit, redFlags, toIntake, weeklyDayRulesText } from "@/lib/counselling/assessment";
import { energyEstimate, bmiBand } from "@/lib/counselling/energy";
import { fitnessAssessment } from "@/lib/counselling/fitness-assessment";
import { counsellingRecord, recordSize } from "@/lib/counselling/record";
import { variantIntake, macrosOf, variantLabel } from "@/lib/counselling/meal-variants";
import { missingRequired, val, list, type Answers } from "@/lib/counselling/questions";
import { estimateProteinIntake, proteinTarget } from "@/lib/protein-intake";
import { runPlanSteps, type PlanProgress } from "@/lib/run-plan-steps";
import FitnessScore from "./FitnessScore";
import PlanProgressBar from "./PlanProgressBar";

/**
 * The client summary the dietitian opens at the end of the consultation.
 *
 * The counselling is a form — 14 sections, one at a time, built for capture.
 * This is its opposite: everything at once, arranged to be talked through with
 * the client sitting there. What they weigh, what their body burns, what they
 * actually eat across a week, what is clinically in the way, and what week 1
 * is aiming at — and only underneath all of that, the button that writes a plan.
 *
 * Nothing here is new data. Every number is derived from answers already
 * recorded, and the full record at the bottom is generated from the question
 * bank itself, so the summary can never quietly fall behind the form.
 */

// Two marks, one accent + one de-emphasised gray. Identity is carried by
// position and a direct label at both ends, never by colour alone, and both
// clear 3:1 on the surface they sit on.
//
// Every value here is a CSS variable rather than a hex, because a chart is the
// one place a theme switch cannot be handled by utilities alone: light mode
// re-steps these to darker marks that hold up on white, and re-points the
// overlap ring to white so it still matches what is underneath it.
const NOW = "var(--chart-now)";
const PLAN = "var(--chart-plan)";
const RING = "var(--chart-ring)";
const MUTED = "var(--chart-muted)";

// Protein / carbohydrate / fat, the same three the finished plan uses, so a
// macro reads identically in counselling and in the PDF.
const MACRO = {
  protein: "var(--macro-protein)",
  carbs: "var(--macro-carbs)",
  fat: "var(--macro-fat)",
};

export default function ClientDossier({
  answers,
  appointmentId,
  preview = false,
}: {
  answers: Answers;
  appointmentId: string | null;
  /** Dev preview: render everything, but never create a real client. */
  preview?: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<PlanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const energy = useMemo(() => energyEstimate(answers), [answers]);
  const intake = useMemo(() => estimateProteinIntake(answers), [answers]);
  const target = useMemo(() => proteinTarget(answers, intake), [answers, intake]);
  const week = useMemo(() => variantIntake(answers), [answers]);
  const flags = useMemo(() => redFlags(answers), [answers]);
  const score = useMemo(() => audit(answers), [answers]);
  const missing = useMemo(() => missingRequired(answers), [answers]);
  const record = useMemo(() => counsellingRecord(answers), [answers]);
  const fitness = useMemo(() => fitnessAssessment(answers), [answers]);
  const form = useMemo(() => toIntake(answers, appointmentId), [answers, appointmentId]);

  const name = val(answers, "name").trim() || "This client";
  const first = name.split(/\s+/)[0];
  const escalations = flags.filter((f) => f.escalate);

  async function generate() {
    setError(null);
    setSubmitting(true);
    try {
      const { clientId } = await runPlanSteps(
        { source: "first", form, ...(appointmentId ? { appointmentId } : {}) },
        setProgress
      );
      router.push(`/clients/${clientId}`);
      return;
    } catch (e) {
      const err = e as Error & { clientId?: string };
      // The client row exists once the first step succeeded — send them to it
      // rather than risking a duplicate from a resubmit.
      if (err.clientId) {
        router.push(`/clients/${err.clientId}`);
        return;
      }
      setError(err.message || "Something went wrong. The counselling is still saved as a draft.");
    }
    setProgress(null);
    setSubmitting(false);
  }

  return (
    <div className="space-y-4 pb-4">
      <Hero
        name={name}
        answers={answers}
        score={score.score}
        band={score.band}
        answersCount={recordSize(record)}
      />

      <KpiStrip energy={energy} intake={intake} target={target} />

      {escalations.length > 0 && <Escalations flags={escalations} />}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <NowVsAim first={first} energy={energy} intake={intake} target={target} />
          <WeekOfEating week={week} intake={intake} />
        </div>
        <div className="space-y-4">
          <BodyJourney answers={answers} energy={energy} />
          <ClinicalCard flags={flags} form={form} />
          <PlateRules answers={answers} form={form} />
          <MovementCard form={form} energy={energy} />
          {fitness.recorded && <FitnessScore answers={answers} compact />}
        </div>
      </div>

      <FullRecord sections={record} />

      {error && (
        <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      <GenerateBar
        first={first}
        missing={missing.length}
        escalations={escalations.length}
        lowScore={score.score < 60 ? score.score : null}
        submitting={submitting}
        progress={progress}
        onGenerate={generate}
        preview={preview}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function Hero({
  name,
  answers,
  score,
  band,
  answersCount,
}: {
  name: string;
  answers: Answers;
  score: number;
  band: string;
  answersCount: number;
}) {
  const facts = [
    val(answers, "q9_age") ? `${val(answers, "q9_age")} yrs` : "",
    val(answers, "gender"),
    val(answers, "q1_occupation") || val(answers, "q54"),
    [val(answers, "q34b"), val(answers, "q34a")].filter(Boolean).join(", "),
    val(answers, "clientCode") ? `Code ${val(answers, "clientCode")}` : "",
  ].filter(Boolean);

  const goal = val(answers, "q2");
  const physique = val(answers, "q6");
  const motivations = list(answers, "q1");
  const why = list(answers, "q4");

  return (
    <header className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-6 sm:px-7">
      {/* A single soft brand wash — decoration behind text never carries meaning. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-brand/10 blur-3xl"
      />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
              First counselling · client summary
            </p>
            <h1 className="mt-1.5 text-3xl font-bold leading-tight sm:text-4xl">{name}</h1>
            {facts.length > 0 && (
              <p className="mt-2 text-sm text-zinc-400">{facts.join("  ·  ")}</p>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                score >= 75
                  ? "bg-emerald-500/15 text-emerald-400"
                  : score >= 60
                    ? "bg-amber-500/15 text-amber-400"
                    : "bg-zinc-800 text-zinc-400"
              }`}
            >
              Counselling {score}/100 · {band}
            </span>
            <span className="text-xs text-zinc-500">{answersCount} answers recorded</span>
            <Link
              href="/counselling/new"
              className="text-xs font-medium text-zinc-400 underline-offset-4 hover:text-brand hover:underline"
            >
              ← Back to edit the counselling
            </Link>
          </div>
        </div>

        {(goal || physique) && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {goal && (
              <span className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-black">
                {goal}
              </span>
            )}
            {physique && (
              <span className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300">
                {physique}
              </span>
            )}
          </div>
        )}

        {(motivations.length > 0 || why.length > 0) && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {motivations.length > 0 && (
              <Quote heading="Why now" items={motivations} />
            )}
            {why.length > 0 && <Quote heading="Why it matters to them" items={why} />}
          </div>
        )}
      </div>
    </header>
  );
}

function Quote({ heading, items }: { heading: string; items: string[] }) {
  return (
    <div className="rounded-xl border-l-2 border-brand/50 bg-zinc-950/40 px-3.5 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{heading}</p>
      <p className="mt-1 text-sm leading-relaxed text-zinc-300">
        {items.map((m, i) => (
          <span key={m}>
            {i > 0 && <span className="text-zinc-600"> · </span>}
            {m}
          </span>
        ))}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function KpiStrip({
  energy,
  intake,
  target,
}: {
  energy: ReturnType<typeof energyEstimate>;
  intake: ReturnType<typeof estimateProteinIntake>;
  target: ReturnType<typeof proteinTarget>;
}) {
  // Single values with no comparison to make — stat tiles, not a chart.
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <Stat
        label="BMI"
        value={energy.bmi ? energy.bmi.toFixed(1) : "—"}
        sub={energy.bmi ? bmiBand(energy.bmi) : "needs height & weight"}
        tone={energy.bmi ? bmiTone(energy.bmi) : undefined}
      />
      <Stat
        label="BMR at rest"
        value={energy.bmr ? String(energy.bmr) : "—"}
        sub={energy.bmr ? "kcal/day" : `needs ${energy.missing.join(", ")}`}
      />
      <Stat
        label="TDEE whole day"
        value={energy.tdee ? String(energy.tdee) : "—"}
        sub={
          energy.activityFactor
            ? `×${energy.activityFactor} activity${energy.trainingDays ? ` · ${energy.trainingDays} training days` : ""}`
            : "needs the above"
        }
      />
      <Stat
        label="Eats now"
        value={intake.kcalPerDay > 0 ? String(intake.kcalPerDay) : "—"}
        sub={intake.kcalPerDay > 0 ? "kcal/day measured" : "record the meals"}
      />
      <Stat
        label="Week-1 protein"
        value={target.targetG ? String(target.targetG) : "—"}
        sub={
          intake.gramsPerKg ? `now ${intake.gramsPerDay} g · ${intake.gramsPerKg} g/kg` : "g/day aim"
        }
        accent
      />
    </div>
  );
}

const bmiTone = (bmi: number): string =>
  bmi < 18.5 || bmi >= 25 ? "text-amber-400" : bmi < 23 ? "text-emerald-400" : "text-amber-400";

function Stat({
  label,
  value,
  sub,
  tone,
  accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3.5 py-3 ${
        accent ? "border-brand/40 bg-brand/5" : "border-zinc-800 bg-zinc-900"
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mt-0.5 text-2xl font-bold tabular-nums ${accent ? "text-brand" : ""}`}>
        {value}
      </div>
      <div className={`mt-0.5 text-[11px] leading-tight ${tone ?? "text-zinc-500"}`}>{sub}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Escalations({ flags }: { flags: ReturnType<typeof redFlags> }) {
  return (
    <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3">
      <h2 className="text-sm font-semibold text-red-400">
        ⚠ {flags.length} clinical red flag{flags.length > 1 ? "s" : ""} — escalate before the plan is
        finalised
      </h2>
      <ul className="mt-1.5 space-y-1">
        {flags.map((f) => (
          <li key={f.id} className="text-xs text-zinc-300">
            <span className="font-semibold">{f.label}</span> — {f.action}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------

function NowVsAim({
  first,
  energy,
  intake,
  target,
}: {
  first: string;
  energy: ReturnType<typeof energyEstimate>;
  intake: ReturnType<typeof estimateProteinIntake>;
  target: ReturnType<typeof proteinTarget>;
}) {
  const rows: { label: string; now: number; plan: number; unit: string }[] = [];
  if (intake.kcalPerDay > 0 && energy.tdee)
    rows.push({ label: "Energy", now: intake.kcalPerDay, plan: energy.tdee, unit: "kcal" });
  if (intake.gramsPerDay > 0 && target.targetG > 0)
    rows.push({ label: "Protein", now: intake.gramsPerDay, plan: target.targetG, unit: "g" });

  if (rows.length === 0) return null;

  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Where {first} is, and where week 1 aims</h2>
        <Legend />
      </div>
      <div className="mt-4 space-y-5">
        {rows.map((r) => (
          <Dumbbell key={r.label} {...r} />
        ))}
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
        {target.explanation}
        {energy.tdee && intake.kcalPerDay > 0 && (
          <>
            {" "}
            The energy mark is the estimated daily need, not a deficit — {first} currently reports{" "}
            {intake.kcalPerDay} kcal against it
            {intake.kcalPerDay < energy.tdee * 0.8 &&
              ", a gap worth questioning with the client before it is trusted"}
            .
          </>
        )}
      </p>
    </section>
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
 * One before → after pair. The connecting line carries the size of the change,
 * the two dots carry the values, and both ends are labelled — so it reads
 * without relying on the colours at all.
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
        <span className="font-medium text-zinc-300">{label}</span>
        <span className="tabular-nums text-zinc-500">
          {delta === 0 ? "no change" : `${delta > 0 ? "+" : "−"}${Math.abs(delta)} ${unit}`}
        </span>
      </div>
      <div className="relative mt-2 h-6">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-zinc-800" />
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
            style={{ left: `${pct(v)}%`, background: c, boxShadow: `0 0 0 2px ${RING}` }}
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

// ---------------------------------------------------------------------------

function WeekOfEating({
  week,
  intake,
}: {
  week: ReturnType<typeof variantIntake>;
  intake: ReturnType<typeof estimateProteinIntake>;
}) {
  if (week.meals.length === 0) return null;
  const peak = Math.max(...week.meals.map((m) => m.perDay.protein_g), 1);

  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">A week of eating, as recorded</h2>
        <span className="text-xs text-zinc-500">
          each option weighted by how many days a week it happens
        </span>
      </div>

      <div className="mt-4 space-y-4">
        {week.meals.map((meal) => {
          const gap = 7 - meal.daysCovered;
          return (
            <div key={meal.key}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-200">{meal.label}</h3>
                <span className="tabular-nums text-xs text-zinc-400">
                  {meal.perDay.protein_g} g protein · {meal.perDay.calories} kcal
                  <span className="text-zinc-600"> per average day</span>
                </span>
              </div>

              {/* Magnitude across meals — a plain bar, directly labelled above. */}
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-900">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, (meal.perDay.protein_g / peak) * 100)}%`,
                    background: MACRO.protein,
                  }}
                />
              </div>

              <ul className="mt-2 space-y-1">
                {meal.variants.map((v) => {
                  const macros = macrosOf(v);
                  return (
                    <li
                      key={v.id}
                      className="flex flex-wrap items-baseline gap-x-2 rounded-lg bg-zinc-900/60 px-2.5 py-1.5 text-xs"
                    >
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-300">
                        {v.daysPerWeek}/7
                      </span>
                      <span className="font-medium text-zinc-200">{variantLabel(v)}</span>
                      <span className="text-zinc-500">
                        {v.items.map((i) => (i.qty ? `${i.food} ${i.qty}` : i.food)).join(", ")}
                      </span>
                      <span className="ml-auto shrink-0 tabular-nums text-zinc-400">
                        {Math.round(macros.protein_g)} g · {Math.round(macros.calories)} kcal
                      </span>
                    </li>
                  );
                })}
              </ul>

              {gap > 0 && (
                <p className="mt-1 text-[11px] text-amber-400/80">
                  {gap} day{gap > 1 ? "s" : ""} of the week unaccounted for at this meal — the
                  average is low by whatever is eaten then.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {intake.measured && intake.foodDay === "counted" && (
        <div className="mt-5 border-t border-zinc-800 pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">What the day is made of</h3>
            <span className="tabular-nums text-xs text-zinc-500">
              {intake.kcalPerDay} kcal · {intake.gramsPerDay} P / {intake.carbsPerDay} C /{" "}
              {intake.fatPerDay} F
            </span>
          </div>
          {/* Parts of one whole: a single stacked bar, 2px surface gaps between
              segments, every segment directly labelled underneath. */}
          <div
            className="mt-2 flex h-2.5 gap-0.5 overflow-hidden rounded-full"
            role="img"
            aria-label={`Energy split: protein ${intake.energySplit.protein}%, carbohydrate ${intake.energySplit.carbs}%, fat ${intake.energySplit.fat}%`}
          >
            {(
              [
                ["protein", intake.energySplit.protein],
                ["carbs", intake.energySplit.carbs],
                ["fat", intake.energySplit.fat],
              ] as const
            ).map(([key, share]) => (
              <div
                key={key}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${share}%`, background: MACRO[key] }}
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            <span style={{ color: MACRO.protein }}>{intake.energySplit.protein}% protein</span>
            {" · "}
            <span style={{ color: MACRO.carbs }}>{intake.energySplit.carbs}% carbs</span>
            {" · "}
            <span style={{ color: MACRO.fat }}>{intake.energySplit.fat}% fat</span> of the calories
            counted here.
          </p>
        </div>
      )}

      {intake.beverages.length > 0 && (
        <div className="mt-4 border-t border-zinc-800 pt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">Drinks through the day</h3>
            <span className="tabular-nums text-xs text-zinc-400">
              {intake.beverageKcalPerDay} kcal
              <span className="text-zinc-600"> — counted on top of the meals</span>
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {intake.beverages.map((b) => (
              <span
                key={b.label}
                className="rounded-lg bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-300 ring-1 ring-zinc-800"
                title={`${b.gramsPerDay.toFixed(1)} g protein · ${b.carbsPerDay.toFixed(1)} g carbs · ${Math.round(b.kcalPerDay)} kcal per day`}
              >
                {b.label}
                {b.units > 1 && <span className="text-zinc-500"> × {b.units}</span>}
                <span className="ml-1.5 tabular-nums text-zinc-500">
                  {Math.round(b.kcalPerDay)} kcal
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {week.unpriced.length > 0 && (
        <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-400">
          Not in the food database, so excluded from every total above:{" "}
          <strong>{week.unpriced.join(", ")}</strong>
        </p>
      )}
      {week.overridden && (
        <p className="mt-3 rounded-lg bg-zinc-900 px-3 py-2 text-[11px] text-zinc-400">
          The daily totals were corrected by the dietitian — the per-meal figures above are the
          database&apos;s, the day total is yours.
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * Every weight on file against the healthy band for their height.
 *
 * Bars from zero rather than a number line: the weights cluster within a few
 * kilos of each other and dots on a shared axis would collide, while bars keep
 * every value directly labelled and still show the band they fall in.
 */
function BodyJourney({
  answers,
  energy,
}: {
  answers: Answers;
  energy: ReturnType<typeof energyEstimate>;
}) {
  const num = (id: string) => {
    const n = Number(val(answers, id));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const height = num("q9_height");
  const rows = [
    { label: "Highest ever", kg: num("q9_weight_high") },
    { label: "A year ago", kg: num("q9_weight_1y") },
    { label: "Now", kg: num("q9_weight"), current: true },
    { label: "Comfortable at", kg: num("q9_weight_comfort") },
    { label: "Lowest adult", kg: num("q9_weight_low") },
  ].filter((r): r is { label: string; kg: number; current?: boolean } => r.kg !== null);

  if (rows.length === 0) return null;

  const m = height ? height / 100 : null;
  const healthy = m ? { low: 18.5 * m ** 2, high: 22.9 * m ** 2 } : null;
  const max = Math.max(...rows.map((r) => r.kg), healthy?.high ?? 0) * 1.08;
  const pct = (kg: number) => (kg / max) * 100;

  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Body</h2>
        {energy.bmi && (
          <span className="text-xs text-zinc-500">
            BMI {energy.bmi.toFixed(1)} · {bmiBand(energy.bmi)}
          </span>
        )}
      </div>

      <div className="relative mt-3 space-y-2.5">
        {/* The healthy band sits behind every bar, so each weight is read
            against it without a second chart. */}
        {healthy && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 rounded"
            style={{
              left: `${pct(healthy.low)}%`,
              width: `${pct(healthy.high) - pct(healthy.low)}%`,
              background: "var(--band-healthy)",
              borderLeft: "1px solid var(--band-healthy-edge)",
              borderRight: "1px solid var(--band-healthy-edge)",
            }}
          />
        )}
        {rows.map((r) => (
          <div key={r.label} className="relative">
            <div className="flex items-baseline justify-between text-[11px]">
              <span className={r.current ? "font-semibold text-zinc-200" : "text-zinc-400"}>
                {r.label}
              </span>
              <span className={`tabular-nums ${r.current ? "text-brand" : "text-zinc-400"}`}>
                {r.kg} kg
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-zinc-900">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(1, pct(r.kg))}%`,
                  background: r.current ? PLAN : MUTED,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {healthy && (
        <p className="mt-2.5 text-[11px] text-zinc-500">
          Shaded band = healthy weight for {height} cm ({healthy.low.toFixed(0)}–
          {healthy.high.toFixed(0)} kg), on ICMR / WHO Asia-Pacific cut-offs.
        </p>
      )}

      <Facts
        rows={[
          ["Height", val(answers, "q9_height") ? `${val(answers, "q9_height")} cm` : ""],
          ["Body fat", val(answers, "q15_bf") ? `${val(answers, "q15_bf")} %` : ""],
          ["Muscle mass", val(answers, "q15_muscle") ? `${val(answers, "q15_muscle")} kg` : ""],
          // Girths are recorded as a bare number because the form itself says
          // "cm — note the unit if inches". Printing "cm" here would assert a
          // unit nobody captured.
          ["Waist", val(answers, "q15_waist")],
          ["Hip", val(answers, "q15_hip")],
          ["Visceral fat", val(answers, "q15_visceral")],
        ]}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------

function ClinicalCard({
  flags,
  form,
}: {
  flags: ReturnType<typeof redFlags>;
  form: ReturnType<typeof toIntake>;
}) {
  const cautions = flags.filter((f) => !f.escalate);
  const rows: [string, string][] = [
    ["Conditions", form.conditions.join(", ")],
    ["Medications", form.medications],
    ["Supplements", form.supplements],
    ["Allergies", form.allergies],
    ["Intolerances", form.intolerances],
    ["Digestion", form.digestion],
    ["Labs", form.labNotes],
  ];
  if (cautions.length === 0 && rows.every(([, v]) => !v)) return null;

  return (
    <section className="card border border-red-500/20">
      <h2 className="text-base font-semibold">Clinical picture</h2>
      {cautions.length > 0 && (
        <ul className="mt-2.5 space-y-1">
          {cautions.map((f) => (
            <li key={f.id} className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-300">
              <span className="font-semibold">{f.label}</span> — {f.action}
            </li>
          ))}
        </ul>
      )}
      <Facts rows={rows} />
    </section>
  );
}

function PlateRules({ answers, form }: { answers: Answers; form: ReturnType<typeof toIntake> }) {
  const dayRules = weeklyDayRulesText(answers);
  const rows: [string, string][] = [
    ["Food pattern", form.dietType],
    ["Cuisines", form.cuisines],
    ["Never serve", [form.allergies, val(answers, "q36")].filter(Boolean).join(", ")],
    ["Loves", form.likes],
    ["Day rules", dayRules],
    ["Cooking", form.cookingTime],
    ["Eats out", form.eatingOutPerWeek ? `${form.eatingOutPerWeek} / week` : ""],
    ["Meals a day", form.mealsPerDay],
  ];
  if (rows.every(([, v]) => !v)) return null;

  return (
    <section className="card">
      <h2 className="text-base font-semibold">What can go on the plate</h2>
      <Facts rows={rows} />
    </section>
  );
}

function MovementCard({
  form,
  energy,
}: {
  form: ReturnType<typeof toIntake>;
  energy: ReturnType<typeof energyEstimate>;
}) {
  const rows: [string, string][] = [
    ["Daily activity", form.activityLevel],
    ["Training", form.exercise],
    ["Counted as", energy.activityFactor ? `×${energy.activityFactor} on BMR` : ""],
    ["Work", form.workSchedule],
    // Both of these are recorded as banded answers that already carry their
    // unit ("6-7 hours", "1.5-2 litres") — appending one reads as "hours hrs".
    ["Sleep", form.sleepHours],
    ["Water", form.waterIntakeLitres],
    ["Alcohol", form.alcohol],
    ["Tobacco", form.smoking],
  ];
  if (rows.every(([, v]) => !v)) return null;

  return (
    <section className="card">
      <h2 className="text-base font-semibold">Movement &amp; lifestyle</h2>
      <Facts rows={rows} />
    </section>
  );
}

/** Label/value rows, empty values dropped so no card shows a row of dashes. */
function Facts({ rows }: { rows: [string, string][] }) {
  const filled = rows.filter(([, v]) => v && v.trim());
  if (filled.length === 0) return null;
  return (
    <dl className="mt-3 space-y-1.5">
      {filled.map(([label, value]) => (
        <div key={label} className="flex gap-3 text-xs">
          <dt className="w-24 shrink-0 text-zinc-500">{label}</dt>
          <dd className="min-w-0 flex-1 text-zinc-300">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------------------

/**
 * The counselling verbatim, section by section.
 *
 * The panels above are a reading of the consultation; this is the consultation.
 * Collapsed by default so the summary stays a summary, but one click away
 * because the client will ask about something that is only in here.
 */
function FullRecord({ sections }: { sections: ReturnType<typeof counsellingRecord> }) {
  const [open, setOpen] = useState(false);
  const total = recordSize(sections);
  if (total === 0) return null;

  return (
    <section className="card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div>
          <h2 className="text-base font-semibold">Everything recorded in this counselling</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {total} answers across {sections.length} sections
          </p>
        </div>
        <span className="shrink-0 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300">
          {open ? "Hide" : "Show all"}
        </span>
      </button>

      {open && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {sections.map((s) => (
            <div key={s.id} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3.5">
              <h3 className="text-sm font-semibold">
                <span className="mr-1.5 text-zinc-600">{s.code}</span>
                {s.title}
              </h3>
              <dl className="mt-2.5 space-y-2">
                {s.items.map((item) => (
                  <div key={item.id}>
                    <dt className="text-[11px] leading-snug text-zinc-500">
                      {item.number && <span className="mr-1 text-zinc-600">Q{item.number}</span>}
                      {item.label}
                    </dt>
                    <dd className="mt-0.5 text-xs text-zinc-200">
                      {item.values.length === 1 ? (
                        item.values[0]
                      ) : (
                        <ul className="space-y-0.5">
                          {item.values.map((v, i) => (
                            <li key={i} className="flex gap-1.5">
                              <span className="text-zinc-600">·</span>
                              <span>{v}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * The action, pinned to the bottom of the viewport.
 *
 * The summary is long by design and the dietitian generates from wherever they
 * happen to be in it — usually mid-conversation — so the button follows rather
 * than waiting at the end.
 */
function GenerateBar({
  first,
  missing,
  escalations,
  lowScore,
  submitting,
  progress,
  onGenerate,
  preview,
}: {
  first: string;
  missing: number;
  escalations: number;
  lowScore: number | null;
  submitting: boolean;
  progress: PlanProgress | null;
  onGenerate: () => void;
  preview: boolean;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 border-t border-zinc-800 bg-zinc-950/85 px-4 py-3 backdrop-blur-md sm:rounded-t-xl">
      {progress && <PlanProgressBar progress={progress} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 text-xs text-zinc-400">
          {preview ? (
            <span className="text-amber-400">
              Preview of fabricated test data — generating is disabled here so no client record is
              created.
            </span>
          ) : missing > 0 ? (
            <Link href="/counselling/new" className="text-red-400 underline underline-offset-4">
              {missing} mandatory question{missing > 1 ? "s" : ""} still unanswered — finish the
              counselling first
            </Link>
          ) : (
            <>
              Macros are grounded in the ICMR-NIN/INDB and USDA databases. You review the draft
              before any PDF is created.
              {escalations > 0 && (
                <span className="text-red-400">
                  {" "}
                  {escalations} red flag{escalations > 1 ? "s" : ""} recorded — escalation is still
                  yours.
                </span>
              )}
              {lowScore !== null && (
                <span className="text-amber-400">
                  {" "}
                  Counselling score {lowScore}/100 — areas are still missing.
                </span>
              )}
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={submitting || missing > 0 || preview}
          className="btn-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Generating…" : `Generate ${first}'s Week 1 plan`}
        </button>
      </div>
    </div>
  );
}

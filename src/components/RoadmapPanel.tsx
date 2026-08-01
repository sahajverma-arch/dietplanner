import { settleWeek, weekTargets, type Roadmap } from "@/lib/roadmap";
import RoadmapGoalBlock from "./RoadmapGoalBlock";

/** The horizon the summary shows. A month is what a client can picture. */
const WEEKS = [1, 2, 3, 4];

/**
 * The computed roadmap, shown on the client summary before anything is planned.
 *
 * This is the arithmetic the diet engine did, laid out so the dietitian can
 * check it in front of the client — the target weight and why it is not the top
 * of the range, what the calories do week by week for the first month, and the
 * macros that follow. Nothing here was written by the model; it is all derived
 * from the counselling by src/lib/roadmap.ts.
 */
export default function RoadmapPanel({
  roadmap,
  atGoal = null,
}: {
  roadmap: Roadmap;
  /** The same client projected at their target weight; see roadmapAtGoal(). */
  atGoal?: Roadmap | null;
}) {
  const stops = roadmap.warnings.filter((w) => w.stop);
  const cautions = roadmap.warnings.filter((w) => !w.stop);
  const { macros } = roadmap;
  const macroKcal = macros.protein_g * 4 + macros.fat_g * 9 + macros.carbs_g * 4;
  const pct = (kcal: number) => (macroKcal > 0 ? Math.round((kcal / macroKcal) * 100) : 0);

  return (
    <section className="card border border-brand/30 bg-brand/5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">The roadmap</h2>
        <span className="text-xs text-zinc-500">
          computed, not written — diet engine v{roadmap.version}
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-400">
        <span className="font-semibold text-zinc-200">{roadmap.category.label}</span>
        <span className="text-zinc-500"> · {roadmap.category.constraint}</span>
      </p>

      {stops.length > 0 && (
        <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2">
          {stops.map((w) => (
            <p key={w.id} className="text-xs text-red-300">
              <strong className="text-red-400">⚠ {w.label}</strong> — {w.detail}
            </p>
          ))}
        </div>
      )}

      {/* Where they are going, and how long it takes. */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Cell label="Target weight" value={`${roadmap.targetWeightKg} kg`} sub={`BMI ${21} · healthy ${roadmap.healthyRangeKg.low}–${roadmap.healthyRangeKg.high} kg`} />
        <Cell label="To lose" value={roadmap.weightToLoseKg > 0 ? `${roadmap.weightToLoseKg} kg` : "—"} sub={roadmap.weightToLoseKg > 0 ? `first milestone ${roadmap.milestone5pctKg} kg (5%)` : "already at target"} />
        <Cell
          label="Timeline"
          value={roadmap.timeline ? `${roadmap.timeline.fastestWeeks}–${roadmap.timeline.slowestWeeks}` : "—"}
          sub={roadmap.timeline ? "weeks, at 0.5–1.0%/week" : "no loss required"}
        />
        {/* "Steady state" meant "after any transition or ramp phase" — engine
            vocabulary that reads as "her settled long-term intake", which made
            the higher maintenance figure in the goal block below look like a
            contradiction rather than the end of the diet. */}
        <Cell
          label="Daily target"
          value={`${roadmap.targetKcal}`}
          sub={
            roadmap.tdee > roadmap.targetKcal
              ? `kcal a day while losing`
              : `kcal a day, maintenance`
          }
          accent
        />
      </div>

      {/* The first four weeks, week by week.
          Phases are how the engine thinks; weeks are how the client lives it.
          A dietitian sitting with someone needs to answer "so what do I eat on
          Monday, and does that change next month" — which a phase list makes
          them work out, and this does not. */}
      <div className="mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">The first four weeks</h3>
          <span className="text-xs text-zinc-500">against a {roadmap.tdee} kcal daily need</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WEEKS.map((w) => {
            const t = weekTargets(roadmap, w);
            const previous = w > 1 ? weekTargets(roadmap, w - 1) : null;
            // Protein counts as a change too. It was climbing 55 → 60 → 65 → 70
            // across these blocks with none of them flagged, because only
            // calories were compared.
            const changed =
              previous !== null &&
              (previous.kcal !== t.kcal || previous.protein_g !== t.protein_g);
            const deficit = Math.round(((roadmap.tdee - t.kcal) / roadmap.tdee) * 100);
            return (
              <div
                key={w}
                className={`rounded-lg px-3 py-2 ${
                  changed || w === 1
                    ? "bg-zinc-900 ring-1 ring-brand/40"
                    : "bg-zinc-900/60"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Week {w}
                  </span>
                  {changed && (
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-brand">
                      changes
                    </span>
                  )}
                </div>
                <div className="text-lg font-bold tabular-nums">{t.kcal}</div>
                <div className="text-[11px] text-zinc-500">
                  {deficit > 0 ? `${deficit}% deficit` : deficit < 0 ? `${-deficit}% surplus` : "maintenance"}
                </div>
                <div className="mt-1.5 flex gap-2 text-[11px] tabular-nums text-zinc-400">
                  <span title="protein">P{t.protein_g}</span>
                  <span title="fat">F{t.fat_g}</span>
                  <span title="carbohydrate">C{t.carbs_g}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Why each phase is what it is — the phases the first four weeks
            actually touch, plus anything still ahead of them. */}
        <ol className="mt-3 space-y-2">
          {roadmap.phases.map((p, i) => {
            const ahead = p.fromWeek > WEEKS.length;
            return (
              <li key={`${p.label}-${i}`} className="flex gap-3">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums ${
                    ahead ? "bg-zinc-900 text-zinc-600" : "bg-zinc-800 text-zinc-300"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-xs">
                    <span className={ahead ? "font-semibold text-zinc-400" : "font-semibold text-zinc-200"}>
                      {p.label}
                    </span>
                    <span className={`ml-2 tabular-nums ${ahead ? "text-zinc-500" : "text-brand"}`}>
                      {p.kcal} kcal
                    </span>
                    {ahead && <span className="ml-2 text-[10px] text-zinc-600">beyond week 4</span>}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{p.note}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <RoadmapGoalBlock roadmap={roadmap} atGoal={atGoal} />
      </div>

      <DeltaTable roadmap={roadmap} />

      {/* Macros, in the order the engine allocates them: protein and fat are
          requirements, carbohydrate is what is left. */}
      <div className="mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          {/* "Macros at the target" collided with the "at the target weight"
              block above it — the same word for the calorie target and the goal
              weight, stacked, showing different protein figures. */}
          <h3 className="text-sm font-semibold">Macros while losing</h3>
          <span className="text-xs text-zinc-500">
            at {roadmap.targetKcal} kcal · protein {roadmap.category.proteinPerKg} g/kg on{" "}
            {roadmap.dosingWeightKg} kg{roadmap.usedAdjustedWeight && " adjusted"}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Cell label="Protein" value={`${macros.protein_g} g`} sub={`${pct(macros.protein_g * 4)}% of energy`} />
          <Cell label="Fat" value={`${macros.fat_g} g`} sub={`${pct(macros.fat_g * 9)}% of energy`} />
          <Cell label="Carbohydrate" value={`${macros.carbs_g} g`} sub={`${pct(macros.carbs_g * 4)}% — the residual`} />
          <Cell label="Fibre" value={`${macros.fibre_g} g`} sub="ICMR-NIN, 30 g floor" />
        </div>
      </div>

      {roadmap.adaptation && (
        <div className="mt-4 rounded-lg bg-zinc-900/60 px-3 py-2.5">
          <h3 className="text-xs font-semibold">
            {roadmap.adaptation.adapted ? "Metabolically adapted" : "Not adapted — measure first"}
          </h3>
          {roadmap.adaptation.reasons.map((r) => (
            <p key={r} className="mt-1 text-[11px] leading-relaxed text-zinc-400">
              · {r}
            </p>
          ))}
          <p className="mt-1.5 text-[11px] font-medium leading-relaxed text-zinc-300">
            {roadmap.adaptation.action}
          </p>
        </div>
      )}

      {cautions.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {cautions.map((w) => (
            <li
              key={w.id}
              className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-300"
            >
              <strong>{w.label}</strong> — {w.detail}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
        The timeline is the arithmetic of energy balance and is optimistic by nature — real loss is
        rarely linear. Present it as a range, and use the 5% milestone as the first target the
        client actually reaches.
      </p>
    </section>
  );
}

/**
 * Now versus the target, per nutrient.
 *
 * "Protein 50 g → 79 g" is an instruction; "protein 79 g" is a number. The
 * delta is what the dietitian actually talks through, and for calories it is a
 * sequence rather than a pair whenever a phase sits in between — which is the
 * form the spec itself uses for the transition: 2,600 → 2,249 → 1,898.
 */
function DeltaTable({ roadmap }: { roadmap: Roadmap }) {
  const now = roadmap.current;
  if (!now) return null;
  // The week everything has arrived, not the last calorie phase: protein
  // usually keeps climbing for weeks after calories have settled, and reading
  // the destination off the calorie phase reported a protein figure that was
  // still mid-ramp as though it were the target.
  const target = weekTargets(roadmap, settleWeek(roadmap));
  const first = weekTargets(roadmap, 1);
  // Only worth showing the middle step where it is genuinely a step.
  const step = (from: number, to: number) => (from !== to ? from : null);

  const rows: { label: string; from: number; via: number | null; to: number; unit: string }[] = [
    { label: "Energy", from: now.kcal, via: step(first.kcal, target.kcal), to: target.kcal, unit: "kcal" },
    {
      label: "Protein",
      from: now.protein_g,
      via: step(first.protein_g, target.protein_g),
      to: target.protein_g,
      unit: "g",
    },
    { label: "Carbohydrate", from: now.carbs_g, via: null, to: target.carbs_g, unit: "g" },
    { label: "Fat", from: now.fat_g, via: null, to: target.fat_g, unit: "g" },
  ];

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">What actually changes</h3>
        <span className="text-xs text-zinc-500">measured now → while losing</span>
      </div>
      <div className="mt-2 space-y-1">
        {rows.map((r) => {
          const change = r.to - r.from;
          return (
            <div key={r.label} className="flex items-baseline gap-2 rounded-lg bg-zinc-900/60 px-3 py-1.5 text-xs">
              <span className="w-24 shrink-0 text-zinc-400">{r.label}</span>
              <span className="tabular-nums text-zinc-400">{r.from}</span>
              <span className="text-zinc-600">→</span>
              {r.via !== null && (
                <>
                  <span className="tabular-nums text-zinc-300">{r.via}</span>
                  <span className="text-zinc-600">→</span>
                </>
              )}
              <span className="font-semibold tabular-nums text-zinc-100">
                {r.to} {r.unit}
              </span>
              <span
                className={`ml-auto shrink-0 tabular-nums ${
                  change > 0 ? "text-emerald-400" : change < 0 ? "text-amber-400" : "text-zinc-600"
                }`}
              >
                {change === 0 ? "no change" : `${change > 0 ? "+" : "−"}${Math.abs(change)} ${r.unit}`}
              </span>
            </div>
          );
        })}
        {/* Fibre has a target but no measurement — the food pricing tracks
            calories and the three macros only. Saying so is better than
            printing a delta from a number nobody counted. */}
        <div className="flex items-baseline gap-2 rounded-lg bg-zinc-900/60 px-3 py-1.5 text-xs">
          <span className="w-24 shrink-0 text-zinc-400">Fibre</span>
          <span className="text-zinc-600">not measured yet</span>
          <span className="text-zinc-600">→</span>
          <span className="font-semibold tabular-nums text-zinc-100">
            {roadmap.macros.fibre_g} g
          </span>
          <span className="ml-auto shrink-0 text-[11px] text-zinc-500">
            build it over two weeks, with more water
          </span>
        </div>
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg bg-zinc-900/60 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${accent ? "text-brand" : ""}`}>{value}</div>
      <div className="text-[11px] leading-tight text-zinc-500">{sub}</div>
    </div>
  );
}

import type { Roadmap } from "@/lib/roadmap";

/**
 * The computed roadmap, shown on the client summary before anything is planned.
 *
 * This is the arithmetic the diet engine did, laid out so the dietitian can
 * check it in front of the client — the target weight and why it is not the top
 * of the range, how long it takes, what the calories do week by week, and the
 * macros that follow. Nothing here was written by the model; it is all derived
 * from the counselling by src/lib/roadmap.ts.
 */
export default function RoadmapPanel({ roadmap }: { roadmap: Roadmap }) {
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
        <Cell label="Daily target" value={`${roadmap.targetKcal}`} sub="kcal, steady state" accent />
      </div>

      {/* The phases. A plan that changes over time reads as arbitrary unless
          each step says what it is for. */}
      <div className="mt-4">
        <h3 className="text-sm font-semibold">How the calories move</h3>
        <ol className="mt-2 space-y-2">
          {roadmap.phases.map((p, i) => (
            <li key={`${p.label}-${i}`} className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold tabular-nums text-zinc-300">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-xs">
                  <span className="font-semibold text-zinc-200">{p.label}</span>
                  <span className="ml-2 tabular-nums text-brand">{p.kcal} kcal</span>
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{p.note}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Macros, in the order the engine allocates them: protein and fat are
          requirements, carbohydrate is what is left. */}
      <div className="mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">Macros at the target</h3>
          <span className="text-xs text-zinc-500">
            protein {roadmap.category.proteinPerKg} g/kg on {roadmap.dosingWeightKg} kg
            {roadmap.usedAdjustedWeight && " adjusted"}
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

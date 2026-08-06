"use client";

import { useMemo, useState } from "react";
import { exchangePlanFor } from "@/lib/exchange-plan";
import type { DietType } from "@/lib/types";

// Preview-only: lets a dietitian/engineer enter a day's macro target (usually
// weekTargets(roadmap, week) from roadmap.ts) and see exactly what
// exchangePlanFor() would build it from, before that solver is wired into
// the live plan generator. Defaults to the roadmap.ts worked example's week 3
// (84 kg / 1.72 m, Category 1) so the page is useful the moment it loads.
const DIET_TYPES: DietType[] = ["vegetarian", "non-vegetarian", "vegan", "eggetarian"];

export default function ExchangePlanTester() {
  const [kcal, setKcal] = useState(1898);
  const [proteinG, setProteinG] = useState(75);
  const [carbsG, setCarbsG] = useState(267);
  const [fatG, setFatG] = useState(59);
  const [fiberG, setFiberG] = useState(30);
  const [dietType, setDietType] = useState<DietType>("vegetarian");
  const [jain, setJain] = useState(false);
  const [proteinHeld, setProteinHeld] = useState(false);

  const result = useMemo(
    () =>
      exchangePlanFor(
        { kcal, proteinG, carbsG, fatG, fiberG },
        { dietType, jain, proteinHeld }
      ),
    [kcal, proteinG, carbsG, fatG, fiberG, dietType, jain, proteinHeld]
  );

  const field = (
    label: string,
    value: number,
    onChange: (n: number) => void
  ) => (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        className="input"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );

  return (
    <div className="card">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {field("Calories", kcal, setKcal)}
        {field("Protein (g)", proteinG, setProteinG)}
        {field("Carbs (g)", carbsG, setCarbsG)}
        {field("Fat (g)", fatG, setFatG)}
        {field("Fibre (g)", fiberG, setFiberG)}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Diet type</label>
          <select
            className="input"
            value={dietType}
            onChange={(e) => setDietType(e.target.value as DietType)}
          >
            {DIET_TYPES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm text-zinc-300">
          <input type="checkbox" checked={jain} onChange={(e) => setJain(e.target.checked)} />
          Jain
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={proteinHeld}
            onChange={(e) => setProteinHeld(e.target.checked)}
          />
          Medical protein hold (renal/hepatic — proteinCapReason set)
        </label>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Exchange counts
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-400">
                <th className="py-2 pr-4">Group</th>
                <th className="py-2 text-right">Exchanges</th>
              </tr>
            </thead>
            <tbody>
              {result.exchanges.map((e) => (
                <tr key={e.groupId} className="border-b border-zinc-800/50">
                  <td className="py-2 pr-4">{e.label}</td>
                  <td className="py-2 text-right font-mono">{e.count}</td>
                </tr>
              ))}
              {result.exchanges.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-4 text-center text-zinc-500">
                    No exchanges — check the target.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {result.fittyProteinUsed && (
            <p className="mt-2 text-xs text-brand">Fitty Protein used to close the whole-food protein gap.</p>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Totals vs target
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-400">
                <th className="py-2 pr-4"></th>
                <th className="py-2 pr-4 text-right">Target</th>
                <th className="py-2 text-right">Planned</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Calories", result.target.kcal, result.totals.kcal, result.calorieWithinBand],
                ["Protein (g)", result.target.proteinG, result.totals.proteinG, result.proteinWithinBand],
                ["Carbs (g)", result.target.carbsG, result.totals.carbsG, true],
                ["Fat (g)", result.target.fatG, result.totals.fatG, true],
                ["Fibre (g)", result.target.fiberG, result.totals.fiberG, true],
              ].map(([label, t, p, ok]) => (
                <tr key={label as string} className="border-b border-zinc-800/50">
                  <td className="py-2 pr-4">{label}</td>
                  <td className="py-2 pr-4 text-right font-mono text-zinc-400">{t as number}</td>
                  <td
                    className={`py-2 text-right font-mono ${
                      ok ? "text-zinc-100" : "text-amber-400"
                    }`}
                  >
                    {p as number}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 flex gap-4 text-xs">
            <span className={result.proteinWithinBand ? "text-emerald-400" : "text-red-400"}>
              Protein {result.proteinWithinBand ? "within band" : "OUT OF BAND"}
            </span>
            <span className={result.calorieWithinBand ? "text-emerald-400" : "text-red-400"}>
              Calories {result.calorieWithinBand ? "within band" : "OUT OF BAND"}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-600">
            App bands (day-targets.ts): protein −5 g / +25%, calories ±15%.
          </p>

          {result.warnings.length > 0 && (
            <ul className="mt-4 space-y-2">
              {result.warnings.map((w, i) => (
                <li key={i} className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                  {w}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

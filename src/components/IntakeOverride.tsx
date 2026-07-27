"use client";

import { useState } from "react";
import type { ProteinIntakeEstimate } from "@/lib/protein-intake";

/**
 * The dietitian's correction of the whole measured day.
 *
 * Every variant can already be corrected individually, but sometimes the sum is
 * simply wrong — a food the database has no row for, a portion the client
 * described loosely, a week that is not really seven typical days. This is the
 * last word, and it matters because this number is not decorative: the week-1
 * protein target is built from it, and the plan is built from that.
 *
 * Deliberately explicit rather than an inline-editable figure. Overriding a
 * measurement is a clinical judgement and should look like one, and the panel
 * keeps showing what the database said so the two can be compared.
 */
export default function IntakeOverride({
  estimate,
  value,
  onChange,
}: {
  estimate: ProteinIntakeEstimate;
  value: string | string[] | undefined;
  onChange: (encoded: string) => void;
}) {
  const active = typeof value === "string" && value.trim().length > 0;
  const [open, setOpen] = useState(false);

  // Seeded from the measurement, so correcting one number does not require
  // retyping the other three.
  const current = {
    calories: estimate.kcalPerDay,
    protein_g: estimate.gramsPerDay,
    carbs_g: estimate.carbsPerDay,
    fat_g: estimate.fatPerDay,
  };
  const setField = (field: keyof typeof current, raw: string) =>
    onChange(JSON.stringify({ ...current, [field]: Math.max(0, Number(raw) || 0) }));

  return (
    <div className="mt-3 border-t border-zinc-800 pt-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-zinc-500">
          {active
            ? "These totals are yours, not the database's."
            : "Numbers not right? They are an estimate — correct them."}
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs font-medium text-brand hover:underline"
        >
          {open ? "Close" : active ? "Edit totals" : "Edit totals"}
        </button>
      </div>

      {open && (
        <>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["protein_g", "Protein g/day"],
                ["calories", "kcal/day"],
                ["carbs_g", "Carbs g/day"],
                ["fat_g", "Fat g/day"],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="block">
                <span className="text-[10px] uppercase tracking-wide text-zinc-500">{label}</span>
                <input
                  className="input py-1 text-sm"
                  type="number"
                  min={0}
                  value={current[field]}
                  onChange={(e) => setField(field, e.target.value)}
                />
              </label>
            ))}
          </div>
          {active && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="mt-2 text-xs font-medium text-zinc-500 hover:text-brand"
            >
              Revert to the measured totals
            </button>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
            The week-1 protein target is calculated from this number, and the diet plan is built to
            that target — so a correction here changes the plan.
          </p>
        </>
      )}
    </div>
  );
}

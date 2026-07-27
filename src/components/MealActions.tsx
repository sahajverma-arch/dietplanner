"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MealAlternate } from "@/lib/nim";

/** A meal the dietitian typed, priced and rule-checked but not yet stored. */
type CustomPreview = {
  alternate: MealAlternate;
  /** Dislikes and weekday rules — the dietitian may overrule these. */
  warnings: string[];
  /** Allergens and diet-pattern breaks — nobody may overrule these. */
  blocking: string[];
  /** Foods the database has no row for; the macros exclude them. */
  unmatched: string[];
};

/**
 * Per-meal editing on the draft preview. The pencil opens a panel of AI
 * alternatives for that one meal slot — same occasion, same calorie/protein
 * band, the client's allergens, dislikes, diet type and weekday rules all still
 * enforced — and the dietitian either swaps the meal out or offers the option
 * alongside it ("OR ...") for the client to choose on the day.
 *
 * Only the opened meal changes; the rest of the week is left exactly as it is.
 */
export default function MealActions({
  planId,
  dayIndex,
  mealIndex,
  dayLabel,
  mealName,
  calories,
  proteinG,
  alternates,
}: {
  planId: string;
  dayIndex: number;
  mealIndex: number;
  dayLabel: string;
  mealName: string;
  calories: number;
  proteinG: number;
  alternates: MealAlternate[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<MealAlternate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The dietitian's own meal: typed, priced from the foods table, then applied.
  const [text, setText] = useState("");
  const [custom, setCustom] = useState<CustomPreview | null>(null);

  async function post(body: Record<string, unknown>) {
    const res = await fetch("/api/plan-meal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, dayIndex, mealIndex, ...body }),
    });
    const json = await res.json().catch(() => ({}));
    // A 409 with `overridable` is not a failure — it is the server asking the
    // dietitian to confirm they mean to overrule a recorded preference.
    if (!res.ok) {
      const err = new Error(json.error || "Something went wrong — try again.") as Error & {
        overridable?: boolean;
      };
      err.overridable = json.overridable === true;
      throw err;
    }
    return json;
  }

  async function loadOptions() {
    setLoading(true);
    setError(null);
    try {
      const json = await post({ type: "alternates" });
      setOptions(json.alternates as MealAlternate[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load alternatives.");
    }
    setLoading(false);
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    // Opening the pencil is the request — don't make them click twice.
    if (next && options === null && !loading) loadOptions();
  }

  async function apply(
    type: "replace" | "add-option",
    alternate: MealAlternate,
    i: number,
    override = false
  ) {
    setBusy(`${type}:${i}`);
    setError(null);
    try {
      await post({ type, alternate, ...(override ? { override: true } : {}) });
      if (i >= 0) {
        // A used option is no longer on offer; the rest stay for a second pick.
        setOptions((prev) => prev?.filter((_, idx) => idx !== i) ?? null);
      } else {
        setCustom(null);
        setText("");
      }
      router.refresh();
    } catch (e) {
      // An overridable refusal keeps the priced preview on screen with its
      // warning, so confirming is one more click rather than a retype.
      setError(e instanceof Error ? e.message : "Could not apply that option.");
    }
    setBusy(null);
  }

  /** Price the typed meal against the foods table. Stores nothing. */
  async function calculate() {
    setBusy("calculate");
    setError(null);
    try {
      const json = await post({ type: "custom", text: text.trim() });
      setCustom({
        alternate: json.alternate as MealAlternate,
        warnings: (json.warnings ?? []) as string[],
        blocking: (json.blocking ?? []) as string[],
        unmatched: (json.unmatched ?? []) as string[],
      });
    } catch (e) {
      setCustom(null);
      setError(e instanceof Error ? e.message : "Could not read that meal.");
    }
    setBusy(null);
  }

  async function removeOption(optionIndex: number) {
    setBusy(`remove:${optionIndex}`);
    setError(null);
    try {
      await post({ type: "remove-option", optionIndex });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove that option.");
    }
    setBusy(null);
  }

  const delta = (value: number, base: number, unit: string) => {
    const d = Math.round(value - base);
    if (base <= 0 || d === 0) return null;
    return (
      <span className={d > 0 ? "text-amber-400" : "text-sky-400"}>
        {d > 0 ? "+" : "−"}
        {Math.abs(d)} {unit}
      </span>
    );
  };

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={`Edit ${dayLabel} ${mealName}`}
        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition ${
          open ? "bg-brand/15 text-brand" : "text-zinc-500 hover:bg-zinc-800 hover:text-brand"
        }`}
      >
        <PencilIcon />
        {open ? "Close" : "Edit meal"}
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {dayLabel} · {mealName} — alternatives
            </h4>
            {options !== null && (
              <button
                type="button"
                className="text-xs font-medium text-brand hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                onClick={loadOptions}
                disabled={loading || busy !== null}
              >
                Show different options
              </button>
            )}
          </div>

          {alternates.length > 0 && (
            <div className="mt-2.5">
              <h5 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Already offered with this meal
              </h5>
              <ul className="mt-1 space-y-1">
                {alternates.map((a, i) => (
                  <li
                    key={i}
                    className="flex items-start justify-between gap-2 rounded bg-zinc-800/60 px-2.5 py-1.5 text-xs"
                  >
                    <span className="min-w-0 text-zinc-300">
                      <span className="font-semibold text-zinc-500">OR </span>
                      {a.items
                        .map((it) => (it.quantity ? `${it.food} — ${it.quantity}` : it.food))
                        .join(", ")}
                      {(a.calories || 0) > 0 && (
                        <span className="ml-1 text-zinc-500">
                          ({Math.round(a.calories)} kcal · P {Math.round(a.protein_g)})
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      disabled={busy !== null}
                      aria-label="Remove this option"
                      className="shrink-0 rounded px-1 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                    >
                      {busy === `remove:${i}` ? "…" : "×"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <p className="mt-2.5 rounded bg-red-500/10 px-2.5 py-1.5 text-xs text-red-400">{error}</p>
          )}

          {loading && (
            <p className="mt-2.5 text-xs text-zinc-500">
              Finding alternatives that match this meal&apos;s calories and protein… (~30s)
            </p>
          )}

          {!loading && options !== null && options.length === 0 && (
            <p className="mt-2.5 text-xs text-zinc-500">
              No further options — ask for different ones, or use the change instructions box above.
            </p>
          )}

          {!loading && options !== null && options.length > 0 && (
            <ul className="mt-2.5 space-y-2">
              {options.map((a, i) => (
                <li key={i} className="rounded-lg border border-zinc-800 bg-zinc-900 p-2.5">
                  <div className="text-sm text-zinc-200">
                    {a.items.map((it, j) => (
                      <div key={j}>
                        {it.food}
                        {it.quantity ? ` — ${it.quantity}` : ""}
                      </div>
                    ))}
                    {a.notes && <div className="mt-0.5 text-xs italic text-zinc-500">{a.notes}</div>}
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                    <span>
                      <span className="font-semibold text-zinc-300">{Math.round(a.calories)} kcal</span>{" "}
                      {delta(a.calories, calories, "kcal")}
                    </span>
                    <span>
                      <span className="text-sky-400">P {Math.round(a.protein_g)}</span>{" "}
                      {delta(a.protein_g, proteinG, "g")}
                    </span>
                    <span className="text-amber-400">C {Math.round(a.carbs_g)}</span>
                    <span className="text-red-400">F {Math.round(a.fat_g)}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => apply("replace", a, i)}
                      disabled={busy !== null}
                    >
                      {busy === `replace:${i}` ? "Replacing…" : "Replace meal"}
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs font-semibold text-zinc-300 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => apply("add-option", a, i)}
                      disabled={busy !== null}
                    >
                      {busy === `add-option:${i}` ? "Adding…" : "Add as option"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* None of the options fit? Write the meal yourself and let the
              foods table do the arithmetic. */}
          <div className="mt-3 border-t border-zinc-800 pt-3">
            <h5 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Or write the meal yourself
            </h5>
            <textarea
              className="input mt-1.5 min-h-[62px] resize-y text-sm"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setCustom(null);
              }}
              disabled={busy !== null}
              placeholder={"e.g. 2 roti, paneer bhurji 1 katori, curd 1 katori, cucumber salad"}
            />
            <div className="mt-1.5 flex items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs font-semibold text-zinc-300 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
                onClick={calculate}
                disabled={busy !== null || text.trim().length < 3}
              >
                {busy === "calculate" ? "Calculating…" : "Calculate macros"}
              </button>
              <span className="text-[11px] text-zinc-600">
                Quantities are read from what you write; protein and calories come from the food
                database.
              </span>
            </div>

            {custom && (
              <div className="mt-2 rounded-lg border border-brand/30 bg-brand/5 p-2.5">
                <div className="text-sm text-zinc-200">
                  {custom.alternate.items.map((it, j) => (
                    <div key={j}>
                      {it.food}
                      {it.quantity ? ` — ${it.quantity}` : ""}
                    </div>
                  ))}
                  {custom.alternate.notes && (
                    <div className="mt-0.5 text-xs italic text-zinc-500">
                      {custom.alternate.notes}
                    </div>
                  )}
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                  <span>
                    <span className="font-semibold text-zinc-300">
                      {Math.round(custom.alternate.calories)} kcal
                    </span>{" "}
                    {delta(custom.alternate.calories, calories, "kcal")}
                  </span>
                  <span>
                    <span className="text-sky-400">P {Math.round(custom.alternate.protein_g)}</span>{" "}
                    {delta(custom.alternate.protein_g, proteinG, "g")}
                  </span>
                  <span className="text-amber-400">C {Math.round(custom.alternate.carbs_g)}</span>
                  <span className="text-red-400">F {Math.round(custom.alternate.fat_g)}</span>
                </div>

                {custom.unmatched.length > 0 && (
                  <p className="mt-2 rounded bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-400">
                    Not in the food database, so the numbers above exclude{" "}
                    {custom.unmatched.length > 1 ? "them" : "it"}:{" "}
                    <strong>{custom.unmatched.join(", ")}</strong>. Rename to a closer dish, or
                    accept that the totals understate this meal.
                  </p>
                )}

                {custom.blocking.length > 0 && (
                  <p className="mt-2 rounded bg-red-500/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-red-400">
                    Cannot be added: {custom.blocking.join("; ")}.
                  </p>
                )}

                {custom.warnings.length > 0 && custom.blocking.length === 0 && (
                  <p className="mt-2 rounded bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-400">
                    Against the client&apos;s recorded preferences: {custom.warnings.join("; ")}.
                    You can still add it — your call, and it will be logged.
                  </p>
                )}

                {custom.blocking.length === 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() =>
                        apply("replace", custom.alternate, -1, custom.warnings.length > 0)
                      }
                      disabled={busy !== null}
                    >
                      {busy === "replace:-1" ? "Replacing…" : "Replace meal"}
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs font-semibold text-zinc-300 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() =>
                        apply("add-option", custom.alternate, -1, custom.warnings.length > 0)
                      }
                      disabled={busy !== null}
                    >
                      {busy === "add-option:-1" ? "Adding…" : "Add as option"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="mt-2.5 text-[11px] leading-relaxed text-zinc-600">
            <strong className="text-zinc-500">Replace</strong> swaps this meal out.{" "}
            <strong className="text-zinc-500">Add as option</strong> keeps it and prints the choice
            under it in the PDF as an &ldquo;OR&rdquo; line. Macros are re-costed from the food
            database, and the day&apos;s total updates on every change.
          </p>
        </div>
      )}
    </div>
  );
}

function PencilIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  decodeVariants,
  encodeVariants,
  macrosOf,
  isOverridden,
  tappedQuantity,
  type MealVariant,
  type VariantMacros,
} from "@/lib/counselling/meal-variants";

/** Taps implied by a quantity string — "4" is four, "2 katoris" is two. */
const unitsOf = (food: string, qty: string): number => {
  const n = parseInt(qty, 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  // Weighed foods count in 50 g steps, so 150 g is three taps.
  return qty.trim().endsWith("g") ? Math.max(1, Math.round(n / 50)) : n;
};

/**
 * Records what a client really eats at one meal.
 *
 * A meal is a list of variants — "bread omelette 3 days, poha 1 day, chilla 1
 * day" — because that is how people eat and how they describe it. Each variant
 * is priced against the foods table as it is entered, so the protein number
 * comes out of the conversation instead of a second round of questions.
 *
 * Every measured number is editable. The database match is a good estimate, not
 * gospel, and the dietitian sitting with the client knows when it is wrong.
 */
export default function MealVariantsInput({
  mealLabel,
  foods,
  value,
  onChange,
}: {
  mealLabel: string;
  /** The tappable vocabulary, narrowed to this client's food pattern. */
  foods: string[];
  value: string | string[] | undefined;
  onChange: (encoded: string) => void;
}) {
  const variants = decodeVariants(value);
  const daysCovered = variants.reduce((s, v) => s + v.daysPerWeek, 0);

  const write = (next: MealVariant[]) => onChange(encodeVariants(next));
  const update = (id: string, patch: Partial<MealVariant>) =>
    write(variants.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const addVariant = () =>
    write([
      ...variants,
      {
        // Date-based ids would collide when two are added in the same
        // millisecond; the index keeps them distinct without a uuid library.
        id: `v${Date.now()}-${variants.length}`,
        label: "",
        items: [],
        // Whatever is left of the week, so the common "one thing every day"
        // case needs no adjustment at all.
        daysPerWeek: Math.max(1, 7 - daysCovered),
      },
    ]);

  return (
    <div className="space-y-2">
      {variants.map((v, i) => (
        <VariantCard
          key={v.id}
          variant={v}
          foods={foods}
          index={i}
          onChange={(patch) => update(v.id, patch)}
          onRemove={() => write(variants.filter((x) => x.id !== v.id))}
        />
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addVariant}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-300 ring-1 ring-zinc-700 transition hover:bg-zinc-800 hover:text-brand"
        >
          + What else do they have for {mealLabel.toLowerCase()}?
        </button>
        {variants.length > 0 && <DaysCoverage covered={daysCovered} />}
      </div>
    </div>
  );
}

/** How much of the week the recorded variants account for. */
function DaysCoverage({ covered }: { covered: number }) {
  if (covered === 7) {
    return <span className="text-xs text-emerald-400">All 7 days accounted for</span>;
  }
  if (covered > 7) {
    return (
      <span className="text-xs text-amber-400">
        {covered} days recorded for a 7-day week — reduce one of the frequencies
      </span>
    );
  }
  return (
    <span className="text-xs text-amber-400">
      {7 - covered} day{7 - covered > 1 ? "s" : ""} unaccounted — what do they have then, or is
      the meal skipped?
    </span>
  );
}

function VariantCard({
  variant,
  foods,
  index,
  onChange,
  onRemove,
}: {
  variant: MealVariant;
  foods: string[];
  index: number;
  onChange: (patch: Partial<MealVariant>) => void;
  onRemove: () => void;
}) {
  const [pricing, setPricing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const macros = macrosOf(variant);
  const filled = variant.items.filter((i) => i.food.trim());
  const typedItems = variant.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !foods.includes(item.food));

  // Price against the foods table whenever the items settle. Debounced, because
  // this fires while the dietitian is still typing a food name.
  const signature = JSON.stringify(filled.map((i) => [i.food.trim(), i.qty.trim()]));
  const lastPriced = useRef<string>("");
  // Tracks the signature as of the latest render, read from inside the async
  // request below — a plain closure would instead see whatever `signature`
  // was when that request started.
  const latestSignature = useRef(signature);
  latestSignature.current = signature;
  const price = useCallback(async () => {
    const mySignature = signature;
    if (filled.length === 0 || mySignature === lastPriced.current) return;
    lastPriced.current = mySignature;
    setPricing(true);
    setError(null);
    try {
      const res = await fetch("/api/price-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: filled.map((i) => ({ food: i.food.trim(), quantity: i.qty.trim() })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not price that");
      // The items may have changed again while this request was in flight
      // (e.g. Roti swapped for Rice) — applying a slower, now-stale response
      // would silently revert those items back to what they were.
      if (latestSignature.current !== mySignature) return;
      onChange({ measured: json.macros as VariantMacros, unpriced: json.unpriced as string[] });
    } catch (e) {
      // Pricing failing must never block the consultation — the dietitian can
      // still type the numbers in.
      if (latestSignature.current === mySignature) {
        setError(e instanceof Error ? e.message : "Could not price that");
        lastPriced.current = "";
      }
    }
    if (latestSignature.current === mySignature) setPricing(false);
    // onChange identity changes every render; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    const t = setTimeout(price, 700);
    return () => clearTimeout(t);
  }, [price]);

  const setItem = (i: number, patch: Partial<{ food: string; qty: string }>) =>
    onChange({ items: variant.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5">
      <div className="flex items-center gap-2">
        <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Option {index + 1}
        </span>
        <input
          className="input flex-1 py-1 text-sm"
          value={variant.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="What do they call it? e.g. bread omelette"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove this option"
          className="shrink-0 rounded px-1.5 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
        >
          ×
        </button>
      </div>

      {/* Tap a food to add one, tap +/− to change the count. Typing a food name
          is the thing that makes a form feel slow mid-consultation, so the
          everyday vocabulary is tappable and only the unusual is typed.
          Each food stays a separate item: a combined "bread and eggs" cannot
          be priced at all. */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {foods.map((food) => {
          const picked = variant.items.find((it) => it.food === food);
          const units = picked ? unitsOf(food, picked.qty) : 0;
          const without = variant.items.filter((it) => it.food !== food);
          const setUnits = (n: number) =>
            onChange({
              items:
                n <= 0
                  ? without
                  : [...without, { food, qty: tappedQuantity(food, Math.min(20, n)) }],
            });

          if (units === 0) {
            return (
              <button
                key={food}
                type="button"
                onClick={() => setUnits(1)}
                className="rounded-lg bg-zinc-900 px-2.5 py-1 text-xs text-zinc-400 ring-1 ring-zinc-700 transition hover:bg-zinc-800 hover:text-zinc-200"
              >
                {food}
              </button>
            );
          }
          return (
            <span
              key={food}
              className="flex items-center gap-1 rounded-lg bg-brand px-1 py-0.5 text-xs font-medium text-black"
            >
              <button
                type="button"
                aria-label={`One less ${food}`}
                onClick={() => setUnits(units - 1)}
                className="h-5 w-5 rounded text-sm leading-none hover:bg-black/15"
              >
                −
              </button>
              <span className="tabular-nums">
                {food} {picked?.qty}
              </span>
              <button
                type="button"
                aria-label={`One more ${food}`}
                onClick={() => setUnits(units + 1)}
                className="h-5 w-5 rounded text-sm leading-none hover:bg-black/15"
              >
                +
              </button>
            </span>
          );
        })}
      </div>

      {/* Anything the list does not cover, typed. */}
      {typedItems.length > 0 && (
        <div className="mt-1.5 space-y-1.5">
          {typedItems.map(({ item, index }) => (
            <div key={index} className="flex items-center gap-1.5">
              <input
                className="input flex-1 py-1 text-sm"
                value={item.food}
                onChange={(e) => setItem(index, { food: e.target.value })}
                placeholder="Anything else, e.g. Aloo tikki"
              />
              <input
                className="input w-24 py-1 text-sm"
                value={item.qty}
                onChange={(e) => setItem(index, { qty: e.target.value })}
                placeholder="1 katori"
              />
              <button
                type="button"
                onClick={() => onChange({ items: variant.items.filter((_, j) => j !== index) })}
                aria-label="Remove this food"
                className="shrink-0 rounded px-1.5 text-zinc-600 hover:bg-red-500/10 hover:text-red-400"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => onChange({ items: [...variant.items, { food: "", qty: "" }] })}
        className="mt-1.5 text-xs font-medium text-brand hover:underline"
      >
        + something else
      </button>

      {/* Frequency: the number that turns one meal into a week. */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-zinc-500">Eaten on</span>
        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange({ daysPerWeek: d })}
            className={`h-7 w-7 rounded text-xs font-semibold transition ${
              variant.daysPerWeek === d
                ? "bg-brand text-black"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {d}
          </button>
        ))}
        <span className="text-xs text-zinc-500">days a week</span>
      </div>

      {/* Measured, and correctable. */}
      <div className="mt-2.5 border-t border-zinc-800 pt-2">
        {pricing && <p className="text-xs text-zinc-500">Costing against the food database…</p>}

        {!pricing && filled.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="font-semibold text-zinc-300">{macros.calories} kcal</span>
              <span className="text-sky-400">P {macros.protein_g}</span>
              <span className="text-amber-400">C {macros.carbs_g}</span>
              <span className="text-red-400">F {macros.fat_g}</span>
              {isOverridden(variant) && (
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  edited
                </span>
              )}
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="ml-auto text-xs font-medium text-brand hover:underline"
              >
                {editing ? "Close" : isOverridden(variant) ? "Edit numbers" : "Not right? Edit"}
              </button>
            </div>

            {variant.unpriced && variant.unpriced.length > 0 && (
              <p className="mt-1.5 rounded bg-amber-500/10 px-2 py-1 text-[11px] leading-relaxed text-amber-400">
                Not in the food database, so the numbers exclude{" "}
                {variant.unpriced.length > 1 ? "them" : "it"}:{" "}
                <strong>{variant.unpriced.join(", ")}</strong>. Rename to a closer dish, or edit the
                numbers below.
              </p>
            )}

            {editing && (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    ["calories", "kcal"],
                    ["protein_g", "Protein g"],
                    ["carbs_g", "Carbs g"],
                    ["fat_g", "Fat g"],
                  ] as const
                ).map(([field, label]) => (
                  <label key={field} className="block">
                    <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                      {label}
                    </span>
                    <input
                      className="input py-1 text-sm"
                      type="number"
                      min={0}
                      value={macros[field]}
                      onChange={(e) =>
                        onChange({
                          override: { ...macros, [field]: Math.max(0, Number(e.target.value) || 0) },
                        })
                      }
                    />
                  </label>
                ))}
                {isOverridden(variant) && (
                  <button
                    type="button"
                    onClick={() => onChange({ override: undefined })}
                    className="col-span-2 justify-self-start text-xs font-medium text-zinc-500 hover:text-brand sm:col-span-4"
                  >
                    Revert to the database numbers
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {error && <p className="mt-1 text-[11px] text-red-400">{error}</p>}
      </div>
    </div>
  );
}

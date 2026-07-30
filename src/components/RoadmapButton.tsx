"use client";

import { useEffect, useRef, useState } from "react";
import { roadmapAtGoal, roadmapFor, roadmapNeeds } from "@/lib/counselling/roadmap-input";
import { settleWeek, weekTargets, type Roadmap } from "@/lib/roadmap";
import type { Answers } from "@/lib/counselling/questions";
import RoadmapGoalBlock from "./RoadmapGoalBlock";

/** The horizon the popup shows in full. A month is what a client can picture. */
const WEEKS = [1, 2, 3, 4];

/**
 * The roadmap, on demand, from inside the counselling.
 *
 * The dietitian needs this mid-call — "so what am I actually eating next month"
 * is asked while the client is still on the line, and until now the only place
 * that answered it was the review page, which meant leaving the form. This
 * computes from the answers in hand, so it fills in as the call progresses.
 *
 * Recomputed on open rather than on every keystroke: the arithmetic is cheap,
 * but a panel that flickers while someone types is a panel nobody reads.
 */
export default function RoadmapButton({ answers }: { answers: Answers }) {
  const [open, setOpen] = useState(false);
  const roadmap = open ? roadmapFor(answers) : null;
  const missing = open && !roadmap ? roadmapNeeds(answers) : [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-700"
      >
        View roadmap
      </button>
      {open && (
        <Dialog onClose={() => setOpen(false)}>
          {roadmap ? (
            <RoadmapBody
              roadmap={roadmap}
              atGoal={roadmapAtGoal(answers, roadmap)}
              name={(answers.name as string | undefined)?.trim()}
            />
          ) : (
            <div className="px-5 py-6">
              <h2 className="text-base font-semibold">The roadmap is not computable yet</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                It still needs <strong className="text-zinc-200">{missing.join(", ")}</strong>.
                Everything else it uses — current intake, the meal pattern — is already measured
                from what has been recorded so far.
              </p>
            </div>
          )}
        </Dialog>
      )}
    </>
  );
}

/**
 * A modal with the conventions a modal owes: Escape closes it, the backdrop
 * closes it, the page underneath does not scroll, and focus starts inside so a
 * keyboard user is not left tabbing through the form behind it.
 */
function Dialog({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Client roadmap"
        // The backdrop closes on click, so the panel must not let its own
        // clicks bubble up into it.
        onClick={(e) => e.stopPropagation()}
        className="my-auto w-full max-w-3xl overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
      >
        <div className="flex justify-end border-b border-zinc-800 px-3 py-2">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg px-2 py-1 text-lg leading-none text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Where the client is now, the next four weeks in full, and where it all lands.
 *
 * The four weeks are the part a dietitian talks through; the settled week is
 * the part clients ask about ("so this is forever?"), and it is deliberately
 * one block rather than a table of twenty rows — the weeks between week 4 and
 * the settle are the same arithmetic continuing, and printing them all buries
 * the destination.
 */
function RoadmapBody({
  roadmap,
  atGoal,
  name,
}: {
  roadmap: Roadmap;
  atGoal: Roadmap | null;
  name?: string;
}) {
  const stops = roadmap.warnings.filter((w) => w.stop);
  const settles = settleWeek(roadmap);
  const final = weekTargets(roadmap, settles);
  const now = roadmap.current;
  // Nothing is left to show beyond the fourth week when everything has already
  // arrived by then — a "week 3" block after a "week 4" block reads as a bug.
  const beyond = settles > WEEKS.length;

  return (
    <div className="px-5 pb-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">
          The roadmap{name ? <span className="text-zinc-400"> · {name}</span> : null}
        </h2>
        <span className="text-xs text-zinc-500">
          computed, not written — diet engine v{roadmap.version}
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-400">
        <span className="font-semibold text-zinc-200">{roadmap.category.label}</span>
        <span className="text-zinc-500"> · {roadmap.category.constraint}</span>
      </p>
      {/* The journey, stated before the weekly numbers.
          Without it the blocks below read as the whole plan, and the last one
          reads as the finish line — which had this panel implying a month-long
          programme for a client facing most of a year. */}
      {roadmap.timeline && (
        <p className="mt-1 text-xs text-zinc-500">
          {roadmap.weightToLoseKg} kg to lose, to {roadmap.targetWeightKg} kg —{" "}
          <strong className="text-zinc-300">
            {roadmap.timeline.fastestWeeks}–{roadmap.timeline.slowestWeeks} weeks
          </strong>{" "}
          at 0.5–1.0% of body weight a week. The weekly figures below are how the plan STARTS, not
          how long it runs.
        </p>
      )}

      {stops.length > 0 && (
        <div className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2">
          {stops.map((w) => (
            <p key={w.id} className="text-xs text-red-300">
              <strong className="text-red-400">⚠ {w.label}</strong> — {w.detail}
            </p>
          ))}
        </div>
      )}

      {/* Where they actually are. Without this the four weeks below are four
          numbers; with it they are a direction of travel. */}
      <div className="mt-4">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Where the client is now
        </h3>
        {now ? (
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-5 gap-y-1 rounded-lg bg-zinc-900 px-3 py-2.5">
            <Figure value={now.kcal} unit="kcal" label="measured" big />
            <Figure value={now.protein_g} unit="g" label="protein" />
            <Figure value={now.carbs_g} unit="g" label="carbs" />
            <Figure value={now.fat_g} unit="g" label="fat" />
            <span className="ml-auto text-[11px] text-zinc-500">
              from the recorded meals and drinks
            </span>
          </div>
        ) : (
          <p className="mt-1.5 rounded-lg bg-zinc-900 px-3 py-2.5 text-xs text-zinc-500">
            Nothing recorded yet — fill the meal timeline and the drinks to measure what the client
            eats now, and every week below becomes a change rather than a number.
          </p>
        )}
      </div>

      {/* The next four weeks, in full. */}
      <div className="mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            The next four weeks
          </h3>
          <span className="text-[11px] text-zinc-500">
            against a {roadmap.tdee} kcal daily need
          </span>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {WEEKS.map((w) => {
            const t = weekTargets(roadmap, w);
            const previous = w > 1 ? weekTargets(roadmap, w - 1) : null;
            const changed =
              previous !== null &&
              (previous.kcal !== t.kcal || previous.protein_g !== t.protein_g);
            return (
              <WeekBlock
                key={w}
                title={`Week ${w}`}
                flag={changed ? "changes" : w === 1 ? "starts here" : undefined}
                highlight={changed || w === 1}
                kcal={t.kcal}
                protein={t.protein_g}
                carbs={t.carbs_g}
                fat={t.fat_g}
                tdee={roadmap.tdee}
              />
            );
          })}
        </div>
      </div>

      {/* From the fourth week to where it settles. */}
      {beyond ? (
        <>
          <div className="mt-1 grid grid-cols-2 sm:grid-cols-4" aria-hidden="true">
            <div className="hidden sm:block" />
            <div className="hidden sm:block" />
            <div className="hidden sm:block" />
            <div className="col-span-2 flex justify-center sm:col-span-1">
              <Arrow />
            </div>
          </div>
          <WeekBlock
            title={`Week ${settles} — the numbers stop changing`}
            flag="not the finish line"
            wide
            kcal={final.kcal}
            protein={final.protein_g}
            carbs={final.carbs_g}
            fat={final.fat_g}
            tdee={roadmap.tdee}
            note={
              (roadmap.proteinPath.length > WEEKS.length
                ? `Protein keeps stepping up 5–20 g a week between week 4 and here, closing a quarter of the remaining gap each week, until it reaches the ${roadmap.macros.protein_g} g this client's weight calls for. `
                : "") +
              `From week ${settles} the prescription holds${
                roadmap.timeline
                  ? ` — and it is held for most of the ${roadmap.timeline.fastestWeeks}–${roadmap.timeline.slowestWeeks} weeks the weight loss itself takes. Recheck it at every follow-up: these figures were computed from the weight recorded today, and a target set at ${Math.round(roadmap.tdee)} kcal of daily need is worth less the further the client gets from that weight.`
                  : "."
              }`
            }
          />
        </>
      ) : (
        <p className="mt-2 rounded-lg bg-zinc-900/60 px-3 py-2 text-[11px] leading-relaxed text-zinc-500">
          Everything has arrived by week {settles} — calories are at their steady state and protein
          is at the {roadmap.macros.protein_g} g requirement, so later weeks repeat week{" "}
          {settles} rather than changing again.
        </p>
      )}

      <RoadmapGoalBlock roadmap={roadmap} atGoal={atGoal} />

      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
        Protein climbs instead of jumping: a quarter of the remaining gap each week, never more than
        20 g, rounded to 5 g. Carbohydrate is the residual, so it absorbs whatever protein has not
        yet claimed — which is why it falls as protein rises while calories stay put.
      </p>
    </div>
  );
}

/** One week: the calorie figure, and the three macros underneath it. */
function WeekBlock({
  title,
  flag,
  highlight = false,
  wide = false,
  kcal,
  protein,
  carbs,
  fat,
  tdee,
  note,
}: {
  title: string;
  flag?: string;
  highlight?: boolean;
  wide?: boolean;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  tdee: number;
  note?: string;
}) {
  const deficit = Math.round(((tdee - kcal) / tdee) * 100);
  return (
    <div
      className={`rounded-lg px-3 py-2 ${
        wide
          ? "border border-brand/40 bg-brand/5"
          : highlight
            ? "bg-zinc-900 ring-1 ring-brand/40"
            : "bg-zinc-900/60"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          {title}
        </span>
        {flag && (
          <span className="text-[9px] font-semibold uppercase tracking-wide text-brand">{flag}</span>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-lg font-bold tabular-nums">{kcal}</span>
        <span className="text-[11px] text-zinc-500">
          kcal ·{" "}
          {deficit > 0 ? `${deficit}% deficit` : deficit < 0 ? `${-deficit}% surplus` : "maintenance"}
        </span>
      </div>
      <div
        className={`mt-1.5 flex gap-3 text-[11px] tabular-nums text-zinc-400 ${wide ? "flex-wrap" : "flex-col sm:flex-row sm:gap-2.5"}`}
      >
        <span>
          <span className="text-zinc-500">P</span> {protein} g
        </span>
        <span>
          <span className="text-zinc-500">C</span> {carbs} g
        </span>
        <span>
          <span className="text-zinc-500">F</span> {fat} g
        </span>
      </div>
      {note && <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">{note}</p>}
    </div>
  );
}

/** Week 4 down into the settled week. */
function Arrow() {
  return (
    <svg width="20" height="26" viewBox="0 0 20 26" className="text-brand">
      <path
        d="M10 1 V 18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="3 3"
        fill="none"
      />
      <path d="M10 25 L 5 17 H 15 Z" fill="currentColor" />
    </svg>
  );
}

function Figure({
  value,
  unit,
  label,
  big = false,
}: {
  value: number;
  unit: string;
  label: string;
  big?: boolean;
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className={`font-bold tabular-nums ${big ? "text-lg" : "text-sm"}`}>{value}</span>
      <span className="text-[11px] text-zinc-500">
        {unit} {label}
      </span>
    </span>
  );
}

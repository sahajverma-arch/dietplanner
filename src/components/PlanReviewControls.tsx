"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlanRevision } from "@/lib/types";
import { runPlanSteps, type PlanProgress } from "@/lib/run-plan-steps";
import PlanProgressBar from "./PlanProgressBar";

/**
 * Human-in-the-loop review of a draft plan preview. The dietitian either
 * approves the draft (renders the final PDF) or writes change instructions
 * ("less paneer, protein max 90g, vary breakfasts") and regenerates the
 * preview — as many rounds as needed.
 */
export default function PlanReviewControls({
  planId,
  weekNumber,
  revisions,
}: {
  planId: string;
  weekNumber: number;
  revisions: PlanRevision[];
}) {
  const router = useRouter();
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState<"revise" | "approve" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<PlanProgress | null>(null);
  // Meals swapped or given options from the pencil menu. A full regeneration
  // rewrites every day, so those edits do not survive it — say so before they
  // click, not after.
  const handEdits = revisions.filter((r) => r.kind === "manual").length;

  async function send(type: "revise" | "approve") {
    setBusy(type);
    setError(null);
    try {
      if (type === "revise") {
        // A revision rebuilds the whole week — too long for one request, so it
        // runs as steps like the original generation.
        await runPlanSteps(
          { source: "revise", planId, instructions: instructions.trim() },
          setProgress
        );
        setInstructions("");
      } else {
        // Approval only renders the PDF: one short request.
        const res = await fetch("/api/generate-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, planId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Something went wrong — try again.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — try again.");
    }
    setProgress(null);
    setBusy(null);
  }

  return (
    <div className="card border border-amber-500/30 bg-amber-500/5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-amber-400">
          Draft preview — Week {weekNumber} needs your review
        </h2>
        <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-400">
          Not final · no PDF yet
        </span>
      </div>
      <p className="mt-1.5 text-sm text-zinc-400">
        Check the preview below: repeated foods, protein/calorie targets, meal timing, portions.
        Edit any single meal with its pencil, approve the draft as-is, or write the changes you
        want and regenerate the whole week.
      </p>

      {revisions.length > 0 && (
        <div className="mt-3 rounded-lg bg-zinc-900/60 px-3 py-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Changes already applied
          </h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-zinc-400">
            {revisions.map((r, i) => (
              <li key={i}>
                {r.instructions}
                {r.kind === "manual" && (
                  <span className="ml-1 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    by hand
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {handEdits > 0 && (
        <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          You edited {handEdits} meal{handEdits > 1 ? "s" : ""} by hand. Regenerating rewrites the
          whole week, so those edits — and any &ldquo;OR&rdquo; options you added — will be lost.
        </p>
      )}

      <textarea
        className="input mt-3 min-h-[90px] resize-y"
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        disabled={busy !== null}
        placeholder={
          "e.g. Too much paneer — vary the protein sources across the week. Keep protein around 80–90 g/day. Swap Day 3 dinner for something lighter. Breakfasts are repetitive."
        }
      />

      {progress && <PlanProgressBar progress={progress} />}

      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="btn-secondary flex-1 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => send("revise")}
          disabled={busy !== null || instructions.trim().length === 0}
        >
          {busy === "revise"
            ? "Applying your changes…"
            : "Apply changes & regenerate preview"}
        </button>
        <button
          type="button"
          className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => send("approve")}
          disabled={busy !== null}
        >
          {busy === "approve" ? "Creating final PDF…" : "Approve & create PDF"}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resumePlanSteps, type PlanProgress } from "@/lib/run-plan-steps";
import PlanProgressBar from "./PlanProgressBar";

/**
 * A generation that stopped part-way — the tab was closed, the connection
 * dropped, or a step failed after its retries.
 *
 * Because every step is saved before the next begins, the work already done is
 * still on the row: resuming picks up at the next step rather than starting the
 * week again. That is the whole point of generating in steps.
 */
export default function ResumePlanCard({
  planId,
  weekNumber,
}: {
  planId: string;
  weekNumber: number;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<PlanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = progress !== null;

  async function resume() {
    setError(null);
    try {
      await resumePlanSteps(planId, setProgress);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finish — try again.");
    }
    setProgress(null);
  }

  return (
    <div className="card border border-brand/30 bg-brand/5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-brand">
          Week {weekNumber} is part-generated
        </h2>
        <span className="rounded-full bg-brand/15 px-3 py-1 text-xs font-semibold text-brand">
          Unfinished
        </span>
      </div>
      <p className="mt-1.5 text-sm text-zinc-400">
        This plan stopped part-way through. Everything generated so far is saved — resuming
        continues from the next step rather than starting the week over.
      </p>

      {progress && <PlanProgressBar progress={progress} />}

      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}

      <button
        type="button"
        className="btn-primary mt-3 disabled:cursor-not-allowed disabled:opacity-40"
        onClick={resume}
        disabled={busy}
      >
        {busy ? "Finishing…" : "Resume generating"}
      </button>
    </div>
  );
}

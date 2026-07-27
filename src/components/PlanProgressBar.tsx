"use client";

import type { PlanProgress } from "@/lib/run-plan-steps";

/**
 * Progress for a stepped generation. Generating a week takes minutes across
 * several requests, so the dietitian is told which part is being written
 * rather than being left with a spinner and a guess.
 */
export default function PlanProgressBar({ progress }: { progress: PlanProgress }) {
  const pct = progress.total > 0 ? Math.min(100, (progress.step / progress.total) * 100) : 0;
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-zinc-300">{progress.label}…</span>
        <span className="shrink-0 tabular-nums text-zinc-500">
          step {Math.min(progress.step + 1, progress.total)} of {progress.total}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-brand transition-all duration-500"
          style={{ width: `${Math.max(4, pct)}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-zinc-600">
        Each part is saved as it finishes — if something fails, only that part is retried.
      </p>
    </div>
  );
}

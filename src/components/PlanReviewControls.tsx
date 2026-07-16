"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlanRevision } from "@/lib/types";

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

  async function send(type: "revise" | "approve") {
    setBusy(type);
    setError(null);
    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          type === "revise" ? { type, planId, instructions: instructions.trim() } : { type, planId }
        ),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Something went wrong — try again.");
      } else {
        setInstructions("");
        router.refresh();
      }
    } catch {
      setError("Network error — try again.");
    }
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
        Approve it as-is, or write the changes you want and regenerate.
      </p>

      {revisions.length > 0 && (
        <div className="mt-3 rounded-lg bg-zinc-900/60 px-3 py-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Changes already applied
          </h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-zinc-400">
            {revisions.map((r, i) => (
              <li key={i}>{r.instructions}</li>
            ))}
          </ul>
        </div>
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
            ? "Applying your changes… (~60s)"
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

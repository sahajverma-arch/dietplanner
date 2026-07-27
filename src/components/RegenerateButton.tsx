"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { runPlanSteps, type PlanProgress } from "@/lib/run-plan-steps";
import PlanProgressBar from "./PlanProgressBar";

export default function RegenerateButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [progress, setProgress] = useState<PlanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = progress !== null;

  async function handleClick() {
    setError(null);
    try {
      await runPlanSteps({ source: "regenerate", clientId }, setProgress);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed — try again.");
    }
    setProgress(null);
  }

  return (
    <div className="mt-4">
      <button type="button" className="btn-primary" onClick={handleClick} disabled={busy}>
        {busy ? "Generating…" : "Generate plan from counselling data"}
      </button>
      {progress && <PlanProgressBar progress={progress} />}
      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}

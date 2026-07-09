"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegenerateButton({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "regenerate", clientId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Generation failed — try again.");
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error — try again.");
    }
    setBusy(false);
  }

  return (
    <div className="mt-4">
      <button type="button" className="btn-primary" onClick={handleClick} disabled={busy}>
        {busy ? "Generating… (30–60s)" : "Generate plan from counselling data"}
      </button>
      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  );
}

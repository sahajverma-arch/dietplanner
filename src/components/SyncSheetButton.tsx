"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Admin-only: manually pulls the Raw_Counselling sheet into Supabase
// (the same thing QStash does automatically every day).
export default function SyncSheetButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync-counselling", { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setResult(`Synced ${json.upserted} rows${json.skipped ? ` (${json.skipped} skipped)` : ""}`);
        router.refresh();
      } else {
        setResult(json.error || "Sync failed");
      }
    } catch {
      setResult("Network error");
    }
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-3">
      {result && <span className="text-xs text-zinc-400">{result}</span>}
      <button onClick={sync} disabled={busy} className="btn-secondary !px-3 !py-1.5 text-xs">
        {busy ? "Syncing…" : "Sync sheet now"}
      </button>
    </div>
  );
}

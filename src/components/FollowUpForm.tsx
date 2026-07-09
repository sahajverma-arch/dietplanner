"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { emptyFollowUp, type FollowUpInput } from "@/lib/types";

export default function FollowUpForm({
  clientId,
  nextWeek,
  lastWeightKg,
}: {
  clientId: string;
  nextWeek: number;
  lastWeightKg: number | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FollowUpInput>(emptyFollowUp);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function set<K extends keyof FollowUpInput>(key: K, value: FollowUpInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "followup", clientId, followup: form }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Plan generation failed. Try again.");
      } else {
        setSuccess(true);
        setForm(emptyFollowUp);
        router.refresh();
      }
    } catch {
      setError("Network error — try again.");
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="card sticky top-20">
      <h2 className="text-base font-semibold">Weekly follow-up</h2>
      <p className="mb-4 mt-0.5 text-xs text-zinc-400">
        Record this week&apos;s check-in, then generate the Week {nextWeek} plan.
      </p>

      <div className="space-y-3">
        <div>
          <label className="label">
            Current weight (kg){lastWeightKg ? ` — was ${lastWeightKg}` : ""}
          </label>
          <input
            className="input"
            type="number"
            step="0.1"
            required
            value={form.weightKg}
            onChange={(e) => set("weightKg", e.target.value)}
            placeholder={lastWeightKg ? String(lastWeightKg) : "72.5"}
          />
        </div>

        <div>
          <label className="label">Adherence to last plan</label>
          <select
            className="input"
            required
            value={form.adherence}
            onChange={(e) => set("adherence", e.target.value)}
          >
            <option value="">Select…</option>
            <option>90–100% — followed almost fully</option>
            <option>70–90% — mostly followed</option>
            <option>50–70% — partially followed</option>
            <option>Below 50% — struggled to follow</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Energy</label>
            <select
              className="input"
              value={form.energyLevel}
              onChange={(e) => set("energyLevel", e.target.value)}
            >
              <option value="">Select…</option>
              <option>Low</option>
              <option>Okay</option>
              <option>Good</option>
              <option>Great</option>
            </select>
          </div>
          <div>
            <label className="label">Hunger</label>
            <select
              className="input"
              value={form.hunger}
              onChange={(e) => set("hunger", e.target.value)}
            >
              <option value="">Select…</option>
              <option>Often hungry</option>
              <option>Sometimes hungry</option>
              <option>Satisfied</option>
              <option>Too full</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Complaints / difficulties</label>
          <textarea
            className="input resize-y"
            rows={2}
            value={form.complaints}
            onChange={(e) => set("complaints", e.target.value)}
            placeholder="Evening cravings, bloating after lunch, bored of breakfast…"
          />
        </div>

        <div>
          <label className="label">Notes for next week</label>
          <textarea
            className="input resize-y"
            rows={2}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Travelling Thu–Fri, add more variety in snacks…"
          />
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}
      {success && (
        <p className="mt-3 rounded-lg bg-brand/10 px-3 py-2 text-sm text-brand">
          New weekly plan generated — it&apos;s now at the top of the plan history.
        </p>
      )}

      <button className="btn-primary mt-4 w-full" disabled={submitting}>
        {submitting ? `Generating Week ${nextWeek} plan…` : `Generate Week ${nextWeek} Plan`}
      </button>
    </form>
  );
}

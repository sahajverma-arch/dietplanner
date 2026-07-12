"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { emptyIntake, type DietType, type IntakeForm } from "@/lib/types";

const SECTIONS = ["Basics", "Food Preferences", "Lifestyle", "Medical", "Notes"] as const;

const CONDITIONS = [
  "Diabetes / Pre-diabetes",
  "Thyroid (hypo/hyper)",
  "PCOS / PCOD",
  "Hypertension",
  "High cholesterol",
  "Fatty liver",
  "Kidney issues",
  "Gout / high uric acid",
  "IBS / digestive issues",
  "Anaemia",
];

type SaveState = "idle" | "saving" | "saved" | "error";

export default function CounsellingForm({
  dietitianId,
  initialDraft,
  appointmentId = null,
}: {
  dietitianId: string;
  initialDraft: IntakeForm | null;
  appointmentId?: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState<IntakeForm>({ ...emptyIntake, ...(initialDraft ?? {}) });
  const [section, setSection] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>(initialDraft ? "saved" : "idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);

  function set<K extends keyof IntakeForm>(key: K, value: IntakeForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // ---- Autosave: debounced upsert into form_drafts while the call is live ----
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setSaveState("saving");
    const t = setTimeout(async () => {
      const { error } = await supabase.from("form_drafts").upsert(
        {
          dietitian_id: dietitianId,
          kind: "first_counselling",
          data: form,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "dietitian_id,kind" }
      );
      if (error) {
        setSaveState("error");
      } else {
        setSaveState("saved");
        setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      }
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  function toggleCondition(c: string) {
    set(
      "conditions",
      form.conditions.includes(c)
        ? form.conditions.filter((x) => x !== c)
        : [...form.conditions, c]
    );
  }

  async function handleSubmit() {
    if (!form.fullName.trim() || !form.age.trim()) {
      setSection(0);
      setError("Please fill in at least the client's name and age (Basics section).");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "first",
          form,
          ...(appointmentId ? { appointmentId } : {}),
        }),
      });
      const json = await res.json();
      if (res.ok) {
        router.push(`/clients/${json.clientId}`);
        return;
      }
      if (json.clientId) {
        // Client was saved but plan generation failed — go retry from client page.
        router.push(`/clients/${json.clientId}`);
        return;
      }
      setError(json.error || "Something went wrong. Your form is still saved as a draft.");
    } catch {
      setError("Network error. Your form is still saved as a draft — try again.");
    }
    setSubmitting(false);
  }

  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? `Saved${savedAt ? ` at ${savedAt}` : ""}`
        : saveState === "error"
          ? "Autosave failed — check connection"
          : "Autosave on";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">New Counselling Session</h1>
          <p className="text-sm text-zinc-400">
            Fill this live during the call — every change autosaves.
          </p>
        </div>
        <span
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            saveState === "error"
              ? "bg-red-500/10 text-red-400"
              : "bg-brand/10 text-brand"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              saveState === "saving"
                ? "animate-pulse bg-amber-400"
                : saveState === "error"
                  ? "bg-red-500"
                  : "bg-brand"
            }`}
          />
          {saveLabel}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        {SECTIONS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setSection(i)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              section === i
                ? "bg-brand text-black shadow-sm"
                : "bg-zinc-900 text-zinc-400 ring-1 ring-zinc-700 hover:bg-zinc-800"
            }`}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      <div className="card">
        {section === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Full name *" value={form.fullName} onChange={(v) => set("fullName", v)} placeholder="Anita Verma" />
            <Text label="Age *" value={form.age} onChange={(v) => set("age", v)} placeholder="32" type="number" />
            <Select label="Gender" value={form.gender} onChange={(v) => set("gender", v)} options={["", "Female", "Male", "Other"]} />
            <Text label="Occupation" value={form.occupation} onChange={(v) => set("occupation", v)} placeholder="Software engineer" />
            <Text label="Height (cm)" value={form.heightCm} onChange={(v) => set("heightCm", v)} placeholder="162" type="number" />
            <Text label="Current weight (kg)" value={form.weightKg} onChange={(v) => set("weightKg", v)} placeholder="74" type="number" />
            <Text label="Target weight (kg)" value={form.targetWeightKg} onChange={(v) => set("targetWeightKg", v)} placeholder="65" type="number" />
            <Select
              label="Primary goal"
              value={form.goal}
              onChange={(v) => set("goal", v)}
              options={["", "Weight loss", "Weight gain", "Muscle gain", "Maintenance", "Manage medical condition", "General wellness"]}
            />
            <Text label="Phone" value={form.phone} onChange={(v) => set("phone", v)} placeholder="+91 98xxxxxx" />
            <Text label="Email" value={form.email} onChange={(v) => set("email", v)} placeholder="client@email.com" type="email" />
          </div>
        )}

        {section === 1 && (
          <div className="space-y-4">
            <div>
              <label className="label">Diet type</label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["vegetarian", "Vegetarian"],
                    ["non-vegetarian", "Non-vegetarian"],
                    ["vegan", "Vegan"],
                    ["eggetarian", "Eggetarian"],
                  ] as [DietType, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set("dietType", value)}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                      form.dietType === value
                        ? "bg-brand text-black"
                        : "bg-zinc-900 text-zinc-400 ring-1 ring-zinc-700 hover:bg-zinc-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Text label="Preferred cuisines" value={form.cuisines} onChange={(v) => set("cuisines", v)} placeholder="North Indian, South Indian, Continental" />
              <Select label="Meals per day" value={form.mealsPerDay} onChange={(v) => set("mealsPerDay", v)} options={["2", "3", "4", "5", "6"]} />
              <Select label="Time to cook" value={form.cookingTime} onChange={(v) => set("cookingTime", v)} options={["", "Minimal (tiffin/quick meals)", "30 min per meal", "Can cook fresh every meal"]} />
            </div>
            <Area label="Foods they like" value={form.likes} onChange={(v) => set("likes", v)} placeholder="Paneer, dal, idli, fruits, curd…" />
            <Area label="Foods they dislike" value={form.dislikes} onChange={(v) => set("dislikes", v)} placeholder="Bottle gourd, oats, raw salads…" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Area label="Allergies (strictly excluded)" value={form.allergies} onChange={(v) => set("allergies", v)} placeholder="Peanuts, shellfish…" />
              <Area label="Intolerances" value={form.intolerances} onChange={(v) => set("intolerances", v)} placeholder="Lactose, gluten…" />
            </div>
          </div>
        )}

        {section === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Activity level"
              value={form.activityLevel}
              onChange={(v) => set("activityLevel", v)}
              options={["", "Sedentary (desk job)", "Lightly active", "Moderately active", "Very active"]}
            />
            <Text label="Exercise routine" value={form.exercise} onChange={(v) => set("exercise", v)} placeholder="Walks 30 min, gym 3x/week…" />
            <Text label="Sleep hours" value={form.sleepHours} onChange={(v) => set("sleepHours", v)} placeholder="6-7" />
            <Text label="Wake-up time" value={form.wakeTime} onChange={(v) => set("wakeTime", v)} placeholder="7:00 AM" />
            <Text label="Bedtime" value={form.bedTime} onChange={(v) => set("bedTime", v)} placeholder="11:30 PM" />
            <Text label="Water intake (litres/day)" value={form.waterIntakeLitres} onChange={(v) => set("waterIntakeLitres", v)} placeholder="2" />
            <Select label="Smoking" value={form.smoking} onChange={(v) => set("smoking", v)} options={["", "No", "Occasionally", "Regularly"]} />
            <Select label="Alcohol" value={form.alcohol} onChange={(v) => set("alcohol", v)} options={["", "No", "Socially", "Weekly", "Frequently"]} />
            <Text label="Eating out (times/week)" value={form.eatingOutPerWeek} onChange={(v) => set("eatingOutPerWeek", v)} placeholder="2" />
            <Select label="Work schedule" value={form.workSchedule} onChange={(v) => set("workSchedule", v)} options={["", "Regular day shift", "Night shift", "Rotational shifts", "Irregular / travel-heavy", "Homemaker", "Student"]} />
          </div>
        )}

        {section === 3 && (
          <div className="space-y-4">
            <div>
              <label className="label">Medical conditions</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {CONDITIONS.map((c) => (
                  <label
                    key={c}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                      form.conditions.includes(c)
                        ? "border-brand/60 bg-brand/10 text-brand"
                        : "border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-brand"
                      checked={form.conditions.includes(c)}
                      onChange={() => toggleCondition(c)}
                    />
                    {c}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Area label="Current medications" value={form.medications} onChange={(v) => set("medications", v)} placeholder="Metformin 500mg…" />
              <Area label="Supplements" value={form.supplements} onChange={(v) => set("supplements", v)} placeholder="Vitamin D, B12…" />
            </div>
            <Area label="Digestion issues" value={form.digestion} onChange={(v) => set("digestion", v)} placeholder="Acidity after fried food, bloating…" />
            <Area label="Recent lab results (if any)" value={form.labNotes} onChange={(v) => set("labNotes", v)} placeholder="HbA1c 6.1, TSH 5.8, Vit D low…" />
          </div>
        )}

        {section === 4 && (
          <Area
            label="Counselling notes"
            value={form.notes}
            onChange={(v) => set("notes", v)}
            rows={8}
            placeholder="Anything else from the call: emotional eating triggers, family meal patterns, festivals coming up, budget constraints…"
          />
        )}
      </div>

      <div className="sticky bottom-0 mt-5 flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/95 p-3 shadow-lg backdrop-blur">
        <button
          type="button"
          className="btn-secondary"
          disabled={section === 0 || submitting}
          onClick={() => setSection((s) => Math.max(0, s - 1))}
        >
          ← Back
        </button>
        {section < SECTIONS.length - 1 ? (
          <button
            type="button"
            className="btn-primary"
            disabled={submitting}
            onClick={() => setSection((s) => Math.min(SECTIONS.length - 1, s + 1))}
          >
            Next: {SECTIONS[section + 1]} →
          </button>
        ) : (
          <button type="button" className="btn-primary" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Generating Week 1 plan… (30–60s)" : "Generate Week 1 Diet Plan"}
          </button>
        )}
      </div>

      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="card max-w-sm text-center">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-brand/20 border-t-brand" />
            <h3 className="font-semibold">Generating the diet plan…</h3>
            <p className="mt-1 text-sm text-zinc-400">
              The AI is building a 1-week plan around this client&apos;s preferences and
              restrictions, then rendering the PDF. This takes about 30–60 seconds.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Small field helpers ----------------------------------------------------

function Text({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o === "" ? "Select…" : o}
          </option>
        ))}
      </select>
    </div>
  );
}

function Area({
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <textarea
        className="input resize-y"
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

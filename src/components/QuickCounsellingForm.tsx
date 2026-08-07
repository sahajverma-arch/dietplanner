"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Field } from "./ClinicalCounsellingForm";
import {
  list,
  problemTypeId,
  PROBLEM_NONE,
  PROBLEM_ALLERGY,
  ROADMAP_CATEGORY_ID,
  ROADMAP_WEEKS_ON_PLAN_ID,
  ROADMAP_WEEKS_STAGNANT_ID,
  type Answers,
  type Question,
} from "@/lib/counselling/questions";
import {
  findQuestion,
  fillUnaskedRequired,
  QUICK_INTAKE_DRAFT_KIND,
  QUICK_INTAKE_MARKER_ID,
} from "@/lib/counselling/quick-intake";
import { INTAKE_OVERRIDE_ID } from "@/lib/counselling/meal-variants";

/**
 * The quick counselling form — only the questions that actually feed the
 * roadmap engine and diet generator, instead of the full ~105-question LeanR
 * bank. See src/lib/counselling/quick-intake.ts for how the rest of the
 * required question set gets satisfied on submit without touching the full
 * form's validation gate, and why every problem food defaults to the
 * stricter "allergy" treatment rather than asking allergy-vs-intolerance
 * per food.
 */

type Group = { title: string; help?: string; ids: string[] };

const GROUPS: Group[] = [
  { title: "Client details", ids: ["name", "gender", "phone", "q9_age", "q9_height", "q9_weight"] },
  {
    title: "Goal & roadmap category",
    help: "The roadmap category is the one judgement call this form can't skip — without it, week-1 calorie and protein targets can't be computed.",
    ids: ["q2", ROADMAP_CATEGORY_ID, ROADMAP_WEEKS_ON_PLAN_ID, ROADMAP_WEEKS_STAGNANT_ID],
  },
  { title: "Activity & training", ids: ["q54c", "q43", "q44a", "q44b", "q44e", "q44d"] },
  {
    title: "Diet type & food safety",
    help: "Every food picked below is treated as a strict allergy (never served) — the quick form doesn't distinguish allergy from milder intolerance. Use the full counselling form if that distinction matters for this client.",
    ids: ["q33", "q27", "q27c", "q36", "q35"],
  },
  { title: "Cuisine / region", ids: ["q34"] },
  { title: "Meal pattern", ids: ["q28"] },
  {
    title: "Day-specific food rules",
    help: "Only needed if something changes on specific weekdays (no non-veg Tuesdays, a weekly fast, etc.) — otherwise leave at \"No restriction\".",
    ids: ["q38", "q38a", "q38b", "q38c"],
  },
  { title: "Medical", ids: ["q17", "q19", "q19a"] },
];

const ESSENTIAL_IDS = ["name", "gender", "q9_age", "q9_height", "q9_weight", ROADMAP_CATEGORY_ID];

type SaveState = "idle" | "saving" | "saved" | "error";

export default function QuickCounsellingForm({
  dietitianId,
  initialAnswers,
  appointmentId = null,
}: {
  dietitianId: string;
  initialAnswers: Answers | null;
  appointmentId?: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [answers, setAnswers] = useState<Answers>(initialAnswers ?? {});
  const [intakeProtein, setIntakeProtein] = useState("");
  const [intakeCarbs, setIntakeCarbs] = useState("");
  const [intakeFat, setIntakeFat] = useState("");
  const [saveState, setSaveState] = useState<SaveState>(initialAnswers ? "saved" : "idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);

  // Seed the three intake numbers from a previously-saved override, if any.
  useEffect(() => {
    const raw = initialAnswers?.[INTAKE_OVERRIDE_ID];
    if (typeof raw === "string" && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          if (typeof parsed.protein_g === "number") setIntakeProtein(String(parsed.protein_g));
          if (typeof parsed.carbs_g === "number") setIntakeCarbs(String(parsed.carbs_g));
          if (typeof parsed.fat_g === "number") setIntakeFat(String(parsed.fat_g));
        }
      } catch {
        /* a malformed saved override is simply ignored */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (id: string, value: string | string[]) => setAnswers((a) => ({ ...a, [id]: value }));

  const toggle = (id: string, option: string, max?: number) =>
    setAnswers((a) => {
      const current = Array.isArray(a[id]) ? (a[id] as string[]) : [];
      if (current.includes(option)) return { ...a, [id]: current.filter((v) => v !== option) };
      if (max && current.length >= max) return a;
      return { ...a, [id]: [...current, option] };
    });

  /**
   * The submitted answers: what was actually asked here, the problem-food
   * safety defaults, the current-intake override, and the quick-intake
   * marker — then fillUnaskedRequired() satisfies everything else
   * missingRequired() would otherwise block on.
   */
  function buildSubmission(): Answers {
    const a: Answers = { ...answers, [QUICK_INTAKE_MARKER_ID]: "true" };

    for (const food of list(a, "q27")) {
      if (food === PROBLEM_NONE) continue;
      a[problemTypeId(food)] = PROBLEM_ALLERGY;
    }

    const p = Number(intakeProtein);
    const c = Number(intakeCarbs);
    const f = Number(intakeFat);
    if ((intakeProtein.trim() && Number.isFinite(p)) || (intakeCarbs.trim() && Number.isFinite(c)) || (intakeFat.trim() && Number.isFinite(f))) {
      const protein_g = Number.isFinite(p) ? p : 0;
      const carbs_g = Number.isFinite(c) ? c : 0;
      const fat_g = Number.isFinite(f) ? f : 0;
      a[INTAKE_OVERRIDE_ID] = JSON.stringify({
        calories: Math.round(protein_g * 4 + carbs_g * 4 + fat_g * 9),
        protein_g,
        carbs_g,
        fat_g,
      });
    }

    return fillUnaskedRequired(a);
  }

  // Autosave the RAW answers (not the sentinel-filled version) — the draft
  // reopens showing exactly what was typed, same as the full form.
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
          kind: QUICK_INTAKE_DRAFT_KIND,
          appointment_id: appointmentId ?? "",
          data: { answers, appointmentId },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "dietitian_id,kind,appointment_id" }
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
  }, [answers, intakeProtein, intakeCarbs, intakeFat]);

  async function handleReview() {
    const missingEssential = ESSENTIAL_IDS.filter((id) => {
      const v = answers[id];
      return Array.isArray(v) ? v.length === 0 : !(v && v.trim());
    });
    if (missingEssential.length > 0) {
      setError(
        `${missingEssential.length} essential field${missingEssential.length > 1 ? "s" : ""} still ` +
          `unanswered — name, gender, age, height, weight and the roadmap category are needed before a plan can be generated.`
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setError(null);
    setSubmitting(true);

    const finalAnswers = buildSubmission();
    const { error: saveError } = await supabase.from("form_drafts").upsert(
      {
        dietitian_id: dietitianId,
        kind: QUICK_INTAKE_DRAFT_KIND,
        appointment_id: appointmentId ?? "",
        data: { answers: finalAnswers, appointmentId },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "dietitian_id,kind,appointment_id" }
    );
    if (saveError) {
      setSaveState("error");
      setError("Could not save the counselling — check the connection and try again.");
      setSubmitting(false);
      return;
    }
    setSaveState("saved");
    router.push(
      appointmentId
        ? `/counselling/review?appointment=${encodeURIComponent(appointmentId)}`
        : "/counselling/review"
    );
  }

  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? `Saved${savedAt ? ` at ${savedAt}` : ""}`
        : saveState === "error"
          ? "Autosave failed — check connection"
          : "Autosave on";

  const row = (id: string) => {
    const q: Question | undefined = findQuestion(id);
    if (!q) return null;
    if (q.showIf && !q.showIf(answers)) return null;
    return <Field key={id} q={q} answers={answers} set={set} toggle={toggle} />;
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Quick Counselling</h1>
          <p className="text-sm text-zinc-400">
            Only what the roadmap and diet plan actually need — everything else the full form
            screens for is skipped, not answered, and is clearly marked as such on the record.
          </p>
        </div>
        <span
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            saveState === "error" ? "bg-red-500/10 text-red-400" : "bg-brand/10 text-brand"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              saveState === "saving" ? "animate-pulse bg-amber-400" : saveState === "error" ? "bg-red-500" : "bg-brand"
            }`}
          />
          {saveLabel}
        </span>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>}

      <div className="space-y-4">
        {GROUPS.map((g) => (
          <div key={g.title} className="card">
            <h2 className="mb-1 text-sm font-semibold">{g.title}</h2>
            {g.help && <p className="mb-3 text-xs text-zinc-500">{g.help}</p>}
            <div className="space-y-4">
              {g.ids.map((id) => row(id))}

              {/* Current intake sits inside "Diet type & food safety" isn't
                  quite right either — its own mini-block, placed right after
                  the meal-pattern group so it reads as "what they eat now". */}
            </div>
          </div>
        ))}

        <div className="card">
          <h2 className="mb-1 text-sm font-semibold">Current intake (approximate, today)</h2>
          <p className="mb-3 text-xs text-zinc-500">
            A rough daily total is enough — this replaces the full form's meal-by-meal recall.
            Calories are derived automatically (4 kcal/g protein and carbs, 9 kcal/g fat).
          </p>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-400">Protein (g)</span>
              <input
                className="input"
                type="number"
                value={intakeProtein}
                onChange={(e) => setIntakeProtein(e.target.value)}
                placeholder="e.g. 55"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-400">Carbs (g)</span>
              <input
                className="input"
                type="number"
                value={intakeCarbs}
                onChange={(e) => setIntakeCarbs(e.target.value)}
                placeholder="e.g. 220"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-400">Fat (g)</span>
              <input
                className="input"
                type="number"
                value={intakeFat}
                onChange={(e) => setIntakeFat(e.target.value)}
                placeholder="e.g. 50"
              />
            </label>
          </div>
          <div className="mt-4">{row("q50a")}</div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button type="button" onClick={handleReview} disabled={submitting} className="btn-primary">
          {submitting ? "Saving…" : "Review & generate →"}
        </button>
      </div>
    </div>
  );
}

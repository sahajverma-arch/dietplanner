"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  answered,
  missingRequired,
  visibleQuestions,
  visibleSections,
  type Answers,
  type Question,
  type Section,
} from "@/lib/counselling/questions";
import { audit, redFlags, toIntake } from "@/lib/counselling/assessment";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function ClinicalCounsellingForm({
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
  const [sectionId, setSectionId] = useState<string>("client");
  const [saveState, setSaveState] = useState<SaveState>(initialAnswers ? "saved" : "idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScore, setShowScore] = useState(false);
  const mounted = useRef(false);

  // Branches appear/disappear as clinical answers change, so everything derives
  // from the current answers rather than being fixed at mount.
  const sections = useMemo(() => visibleSections(answers), [answers]);
  const section = sections.find((s) => s.id === sectionId) ?? sections[0];
  const flags = useMemo(() => redFlags(answers), [answers]);
  const score = useMemo(() => audit(answers), [answers]);
  const missing = useMemo(() => missingRequired(answers), [answers]);

  const set = (id: string, value: string | string[]) =>
    setAnswers((a) => ({ ...a, [id]: value }));

  // Selection order is preserved (click order = rank on "select up to N"
  // questions); clicks beyond the question's max are ignored.
  const toggle = (id: string, option: string, max?: number) =>
    setAnswers((a) => {
      const current = Array.isArray(a[id]) ? (a[id] as string[]) : [];
      if (current.includes(option)) {
        return { ...a, [id]: current.filter((v) => v !== option) };
      }
      if (max && current.length >= max) return a;
      return { ...a, [id]: [...current, option] };
    });

  // Autosave — the call is live, nothing may be lost.
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
          data: { answers, appointmentId },
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
  }, [answers]);

  async function handleSubmit() {
    const name = (answers.name as string | undefined)?.trim();
    if (!name) {
      setSectionId("client");
      setError("Client name is required (Client details).");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (missing.length > 0) {
      setSectionId(missing[0].sectionId);
      setError(
        `${missing.length} mandatory question${missing.length > 1 ? "s are" : " is"} still unanswered — complete the sections marked in red before generating the plan.`
      );
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
          form: toIntake(answers, appointmentId),
          ...(appointmentId ? { appointmentId } : {}),
        }),
      });
      const json = await res.json();
      if (res.ok || json.clientId) {
        router.push(`/clients/${json.clientId}`);
        return;
      }
      setError(json.error || "Something went wrong. Your counselling is still saved as a draft.");
    } catch {
      setError(
        "The connection dropped while the plan was generating — the server usually finishes anyway. " +
          "Check My Clients in a minute: if the client is there, open it (the preview may already be " +
          "waiting, or use its retry button). Only resubmit here if the client never appeared — " +
          "your counselling is still saved as a draft."
      );
    }
    setSubmitting(false);
  }

  const stages = useMemo(() => {
    const order: string[] = [];
    for (const s of sections) if (!order.includes(s.stage)) order.push(s.stage);
    return order;
  }, [sections]);

  const sectionProgress = (s: Section) => {
    const qs = visibleQuestions(s, answers);
    const done = qs.filter((q) => answered(answers, q.id)).length;
    const requiredLeft = qs.filter((q) => q.required && !answered(answers, q.id)).length;
    return { done, total: qs.length, requiredLeft };
  };

  const index = sections.findIndex((s) => s.id === section?.id);
  const escalations = flags.filter((f) => f.escalate);

  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? `Saved${savedAt ? ` at ${savedAt}` : ""}`
        : saveState === "error"
          ? "Autosave failed — check connection"
          : "Autosave on";

  if (!section) return null;

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">LeanR Premium — First Counselling</h1>
          <p className="text-sm text-zinc-400">
            55–65 min consultation · conversational — select options, don&apos;t read them out ·
            everything autosaves.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowScore((v) => !v)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              score.score >= 75
                ? "bg-emerald-500/15 text-emerald-400"
                : score.score >= 60
                  ? "bg-amber-500/15 text-amber-400"
                  : "bg-zinc-800 text-zinc-400"
            }`}
          >
            Counselling score {score.score}/100 · {score.band}
          </button>
          <span
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              saveState === "error" ? "bg-red-500/10 text-red-400" : "bg-brand/10 text-brand"
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
      </div>

      {/* Quality audit breakdown */}
      {showScore && (
        <div className="card mb-4">
          <h3 className="mb-3 text-sm font-semibold">Counselling quality audit</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {score.categories.map((c) => (
              <div key={c.name} className="text-xs">
                <div className="flex justify-between">
                  <span className="font-medium">{c.name}</span>
                  <span className={c.earned === c.max ? "text-emerald-400" : "text-zinc-400"}>
                    {c.earned}/{c.max}
                  </span>
                </div>
                {c.missing.length > 0 && (
                  <p className="text-zinc-500">missing: {c.missing.join(", ")}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Red flags */}
      {flags.length > 0 && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 ${
            escalations.length ? "bg-red-500/10 ring-1 ring-red-500/30" : "bg-amber-500/10"
          }`}
        >
          <h3 className={`mb-1.5 text-sm font-semibold ${escalations.length ? "text-red-400" : "text-amber-400"}`}>
            {escalations.length ? "⚠ Clinical red flags — escalate before finalising the plan" : "Clinical cautions"}
          </h3>
          <ul className="space-y-1">
            {flags.map((f) => (
              <li key={f.id} className="text-xs text-zinc-300">
                <span className="font-semibold">{f.label}</span> — {f.action}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      <div className="flex flex-col gap-5 lg:flex-row">
        {/* Section navigation */}
        <nav className="lg:w-64 lg:shrink-0">
          <div className="card !p-3">
            {stages.map((stage) => (
              <div key={stage} className="mb-3 last:mb-0">
                <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {stage}
                </p>
                {sections
                  .filter((s) => s.stage === stage)
                  .map((s) => {
                    const { done, total, requiredLeft } = sectionProgress(s);
                    const active = s.id === section.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSectionId(s.id);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className={`mb-0.5 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition ${
                          active ? "bg-brand text-black" : "text-zinc-400 hover:bg-zinc-800"
                        }`}
                      >
                        <span className="truncate">{s.title}</span>
                        <span className="ml-2 flex shrink-0 items-center gap-1.5">
                          {requiredLeft > 0 && (
                            <span
                              className={`rounded px-1 text-[10px] font-semibold ${
                                active ? "bg-black/15 text-black" : "bg-red-500/15 text-red-400"
                              }`}
                              title={`${requiredLeft} mandatory unanswered`}
                            >
                              {requiredLeft}*
                            </span>
                          )}
                          <span
                            className={`tabular-nums ${
                              active
                                ? "text-black/60"
                                : done === total && total > 0
                                  ? "text-emerald-400"
                                  : "text-zinc-600"
                            }`}
                          >
                            {done}/{total}
                          </span>
                        </span>
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </nav>

        {/* Questions */}
        <div className="min-w-0 flex-1">
          <div className="card">
            <div className="mb-5 border-b border-zinc-800 pb-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-semibold">
                  <span className="mr-2 text-zinc-500">{section.code}</span>
                  {section.title}
                </h2>
                {section.minutes && (
                  <span className="shrink-0 text-xs text-zinc-500">{section.minutes}</span>
                )}
              </div>
              {section.intro && <p className="mt-1.5 text-sm text-zinc-400">{section.intro}</p>}
            </div>

            <div className="space-y-6">
              {visibleQuestions(section, answers).map((q) => (
                <Field key={q.id} q={q} answers={answers} set={set} toggle={toggle} />
              ))}
            </div>
          </div>

          {/* Footer nav */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={index <= 0}
              onClick={() => {
                setSectionId(sections[index - 1].id);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="btn-secondary disabled:opacity-40"
            >
              ← Previous
            </button>

            {index < sections.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  setSectionId(sections[index + 1].id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="btn-secondary"
              >
                Next: {sections[index + 1].title} →
              </button>
            ) : (
              <span className="text-xs text-zinc-500">Last section</span>
            )}
          </div>

          {/* Submit */}
          <div className="card mt-4">
            <h3 className="text-sm font-semibold">Generate the Week 1 diet preview</h3>
            <p className="mt-1 text-xs text-zinc-400">
              The plan is built from the full assessment — goal, clinical restrictions, current
              diet, protein pattern, training, barriers and your priorities. Macros are grounded
              in the ICMR-NIN/INDB and USDA food databases. You&apos;ll review the preview first —
              request any changes in writing — and the final PDF is only created once you approve.
            </p>
            {escalations.length > 0 && (
              <p className="mt-2 rounded bg-red-500/10 px-3 py-2 text-xs text-red-400">
                {escalations.length} clinical red flag{escalations.length > 1 ? "s" : ""} recorded.
                The plan will include them, but medical escalation is still your responsibility.
              </p>
            )}
            {score.score < 60 && (
              <p className="mt-2 rounded bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
                Counselling score is {score.score}/100 — important areas are still missing. Review
                before finalising.
              </p>
            )}
            {missing.length > 0 && (
              <div className="mt-2 rounded bg-red-500/10 px-3 py-2 text-xs">
                <p className="font-semibold text-red-400">
                  {missing.length} mandatory question{missing.length > 1 ? "s" : ""} (*) unanswered —
                  the plan can only be generated once these are complete:
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {Object.entries(
                    missing.reduce<Record<string, { sectionId: string; count: number }>>((acc, m) => {
                      acc[m.sectionTitle] = {
                        sectionId: m.sectionId,
                        count: (acc[m.sectionTitle]?.count ?? 0) + 1,
                      };
                      return acc;
                    }, {})
                  ).map(([title, { sectionId: sid, count }]) => (
                    <button
                      key={sid}
                      type="button"
                      onClick={() => {
                        setSectionId(sid);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="rounded bg-zinc-900 px-2 py-1 text-zinc-300 ring-1 ring-red-500/30 hover:bg-zinc-800"
                    >
                      {title} · {count}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting || missing.length > 0}
              className="btn-primary mt-3 w-full disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting
                ? "Generating preview… (this takes ~60s)"
                : missing.length > 0
                  ? `Answer ${missing.length} mandatory question${missing.length > 1 ? "s" : ""} to generate the plan`
                  : "Generate Week 1 Diet Preview"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Field({
  q,
  answers,
  set,
  toggle,
}: {
  q: Question;
  answers: Answers;
  set: (id: string, v: string | string[]) => void;
  toggle: (id: string, option: string, max?: number) => void;
}) {
  const value = answers[q.id];
  const text = typeof value === "string" ? value : "";
  const chosen = Array.isArray(value) ? value : [];
  const isRedFlagNote = q.note?.startsWith("RED FLAG");

  return (
    <div>
      <label className="mb-1 flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
        {q.n && <span className="text-xs text-zinc-600">Q{q.n}</span>}
        <span>
          {q.label}
          {q.required && (
            <span className="ml-1 text-red-400" title="Mandatory — required before plan generation">
              *
            </span>
          )}
        </span>
        {q.tag && q.tag !== "core" && (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
              q.tag === "clinical"
                ? "bg-red-500/15 text-red-400"
                : q.tag === "fitness"
                  ? "bg-sky-500/15 text-sky-400"
                  : q.tag === "planning"
                    ? "bg-brand/15 text-brand"
                    : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {q.tag}
          </span>
        )}
      </label>

      {q.probe && <p className="mb-1.5 text-xs text-zinc-500">Probe: {q.probe}</p>}
      {q.why && <p className="mb-1.5 text-xs text-zinc-500">{q.why}</p>}

      {q.type === "text" && (
        <input
          className="input"
          value={text}
          placeholder={q.placeholder}
          onChange={(e) => set(q.id, e.target.value)}
        />
      )}

      {q.type === "number" && (
        <input
          className="input"
          type="number"
          value={text}
          placeholder={q.placeholder}
          onChange={(e) => set(q.id, e.target.value)}
        />
      )}

      {q.type === "time" && (
        <input className="input" type="time" value={text} onChange={(e) => set(q.id, e.target.value)} />
      )}

      {q.type === "date" && (
        <input className="input" type="date" value={text} onChange={(e) => set(q.id, e.target.value)} />
      )}

      {q.type === "textarea" && (
        <textarea
          className="input min-h-[80px]"
          value={text}
          placeholder={q.placeholder}
          onChange={(e) => set(q.id, e.target.value)}
        />
      )}

      {q.type === "single" && (
        <div className="flex flex-wrap gap-1.5">
          {q.options?.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => set(q.id, text === o ? "" : o)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                text === o
                  ? "bg-brand font-medium text-black"
                  : "bg-zinc-900 text-zinc-400 ring-1 ring-zinc-700 hover:bg-zinc-800"
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      )}

      {q.type === "multi" && (
        <div>
          {q.max && (
            <p className="mb-1.5 text-xs text-zinc-500">
              Select up to {q.max} · {chosen.length} selected
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {q.options?.map((o) => {
              const active = chosen.includes(o);
              const capped = Boolean(q.max && !active && chosen.length >= q.max);
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => toggle(q.id, o, q.max)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    active
                      ? "bg-brand font-medium text-black"
                      : capped
                        ? "cursor-not-allowed bg-zinc-900 text-zinc-600 ring-1 ring-zinc-800"
                        : "bg-zinc-900 text-zinc-400 ring-1 ring-zinc-700 hover:bg-zinc-800"
                  }`}
                >
                  {o}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {q.type === "scale10" && (
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => set(q.id, text === o ? "" : o)}
              className={`h-9 w-9 rounded-lg text-sm tabular-nums transition ${
                text === o
                  ? "bg-brand font-semibold text-black"
                  : "bg-zinc-900 text-zinc-400 ring-1 ring-zinc-700 hover:bg-zinc-800"
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      )}

      {q.note && (
        <p
          className={`mt-1.5 rounded px-2 py-1 text-xs ${
            isRedFlagNote ? "bg-red-500/10 text-red-400" : "bg-zinc-800/60 text-zinc-400"
          }`}
        >
          {q.note}
        </p>
      )}
    </div>
  );
}

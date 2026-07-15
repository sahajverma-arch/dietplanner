import { redFlags, weeklyDayRulesText } from "@/lib/counselling/assessment";
import { list, val, type Answers } from "@/lib/counselling/questions";
import type { ClientRow, IntakeForm } from "@/lib/types";

// ---------------------------------------------------------------------------
// Client summary box — the at-a-glance clinical picture shown at the top of a
// client's page: vitals, red flags, food safety, goal, medical and lifestyle.
// Works for both LeanR counselled clients (rich `intake.answers`) and legacy
// flat intakes; rows without content simply don't render.
// ---------------------------------------------------------------------------

type Row = { label: string; value: string; danger?: boolean };

function Section({ title, rows }: { title: string; rows: Row[] }) {
  const filled = rows.filter((r) => r.value && r.value.trim());
  if (filled.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      <dl className="mt-1.5 space-y-1">
        {filled.map((r) => (
          <div key={r.label} className="text-sm leading-snug">
            <dt className="inline font-medium text-zinc-400">{r.label}: </dt>
            <dd className={`inline ${r.danger ? "font-semibold text-red-300" : "text-zinc-200"}`}>
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const joined = (a: Answers, id: string, drop: string[] = []) =>
  list(a, id)
    .filter((v) => !drop.includes(v))
    .join(", ");

export default function ClientSummary({ client }: { client: ClientRow }) {
  const intake = (client.intake ?? {}) as IntakeForm & { answers?: Answers };
  const answers = intake.answers;
  const flags = answers ? redFlags(answers) : [];

  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const heightCm = num(client.height_cm) ?? num(intake.heightCm);
  const weightKg = num(client.weight_kg) ?? num(intake.weightKg);
  const bmi = heightCm && weightKg ? (weightKg / (heightCm / 100) ** 2).toFixed(1) : "";

  const vitals: [string, string][] = [
    ["Age", client.age ? String(client.age) : intake.age || "—"],
    ["Gender", client.gender || intake.gender || "—"],
    ["Height", heightCm ? `${heightCm} cm` : "—"],
    ["Weight", weightKg ? `${weightKg} kg` : "—"],
    ["BMI", bmi || "—"],
    ["Target", intake.targetWeightKg ? `${intake.targetWeightKg} kg` : "—"],
    ["Diet", client.diet_type || intake.dietType || "—"],
    ["Goal", client.goal || intake.goal || "—"],
  ];

  const deadline = answers
    ? [val(answers, "q7") === "No deadline" ? "" : val(answers, "q7"), val(answers, "q7a")]
        .filter(Boolean)
        .join(" · ")
    : "";
  const outOf10 = (v: string) => (v ? `${v}/10` : "");

  const conditions = Array.isArray(intake.conditions)
    ? intake.conditions.join(", ")
    : String(intake.conditions ?? "");

  return (
    <section className="card mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Client summary</h2>
        <span className="font-mono text-xs text-zinc-500" title={client.id}>
          Client ID: {client.id}
        </span>
      </div>

      {flags.length > 0 && (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-red-400">
            Red flags ({flags.length})
          </h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-zinc-300">
            {flags.map((f) => (
              <li key={f.id}>
                <span className="font-semibold text-red-300">
                  {f.label}
                  {f.escalate ? " — ESCALATE" : ""}
                </span>{" "}
                · {f.action}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {vitals.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              {label}
            </div>
            <div className="truncate text-sm font-semibold capitalize" title={value}>
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Section
          title="Food safety"
          rows={[
            { label: "Allergies", value: intake.allergies, danger: true },
            {
              label: "Allergy severity",
              value: answers ? val(answers, "q27a") : "",
              danger: true,
            },
            { label: "Intolerances", value: intake.intolerances },
            { label: "Dislikes", value: intake.dislikes },
          ]}
        />
        <Section
          title="Medical"
          rows={[
            { label: "Conditions", value: conditions },
            { label: "Condition status", value: answers ? val(answers, "q17a") : "" },
            { label: "Medications", value: intake.medications },
            { label: "Supplements", value: intake.supplements },
            { label: "Digestion", value: intake.digestion },
            { label: "Blood reports", value: intake.labNotes },
            {
              label: "Doctor instructions",
              value: answers
                ? [joined(answers, "q22", ["No instruction"]), val(answers, "q22a")]
                    .filter(Boolean)
                    .join(" — ")
                : "",
            },
          ]}
        />
        <Section
          title="Goal & readiness"
          rows={[
            { label: "Deadline", value: deadline },
            { label: "Readiness", value: answers ? outOf10(val(answers, "q8")) : "" },
            {
              label: "Confidence",
              value: answers ? outOf10(val(answers, "q105") || val(answers, "q75")) : "",
            },
            {
              label: "Realistic first changes",
              value: answers ? val(answers, "q74") : "",
            },
          ]}
        />
        <Section
          title="Food preferences"
          rows={[
            { label: "Cuisines", value: intake.cuisines },
            { label: "Favourites", value: intake.likes },
            {
              label: "Non-negotiables",
              value: answers ? joined(answers, "q37", ["No strong non-negotiable"]) : "",
            },
            { label: "Day-specific rules", value: answers ? weeklyDayRulesText(answers) : "" },
            { label: "Meals/day", value: intake.mealsPerDay },
            { label: "Cooking time", value: intake.cookingTime },
          ]}
        />
        <Section
          title="Lifestyle"
          rows={[
            { label: "Work", value: intake.workSchedule || intake.occupation },
            { label: "Activity", value: intake.activityLevel },
            { label: "Exercise", value: intake.exercise },
            { label: "Sleep", value: intake.sleepHours },
            { label: "Stress", value: answers ? outOf10(val(answers, "q62")) : "" },
            { label: "Water", value: intake.waterIntakeLitres },
            { label: "Alcohol", value: intake.alcohol },
            { label: "Smoking/tobacco", value: intake.smoking },
            { label: "Eating out", value: intake.eatingOutPerWeek },
          ]}
        />
        <Section
          title="Contact & notes"
          rows={[
            { label: "Phone", value: intake.phone },
            { label: "Email", value: intake.email },
            {
              label: "Protect in plan",
              value: answers ? val(answers, "q78") : "",
            },
            // Legacy intakes keep free-text notes; LeanR notes are q78 + day
            // rules, both already shown above.
            { label: "Notes", value: answers ? "" : intake.notes },
          ]}
        />
      </div>
    </section>
  );
}

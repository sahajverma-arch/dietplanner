"use client";

// Development-only preview of the counselling intake panel.
//
// The panel only appears deep inside a real consultation — after Q33, a Q50
// food with a frequency, and the Q28 food day — so reviewing a change to it
// otherwise means clicking through most of a 105-question form. This page
// renders the SAME component with a finished test client loaded, so what you
// see here is what a dietitian sees mid-consultation.
//
// notFound() in any non-development build: this bypasses no authentication
// (the middleware still guards the route), but a page whose whole purpose is
// showing fabricated client data has no business existing in production.

import { useState } from "react";
import { notFound } from "next/navigation";
import { ProteinIntakePanel } from "@/components/ClinicalCounsellingForm";
import type { Answers } from "@/lib/counselling/questions";
import { PRIYA, RAHUL, SNEHA, AADI } from "../../../../scripts/test-clients";

const CLIENTS: { name: string; note: string; answers: Answers }[] = [
  { name: "Priya", note: "32F vegetarian, PCOS + hypothyroid", answers: PRIYA as Answers },
  { name: "Rahul", note: "non-vegetarian, trains, no-meat Tue/Thu", answers: RAHUL as Answers },
  { name: "Sneha", note: "highest fat share of the four", answers: SNEHA as Answers },
  { name: "Aadi", note: "highest carb intake of the four", answers: AADI as Answers },
];

export default function IntakePreviewPage() {
  // Hook first: an early return above it would break the rules of hooks.
  const [i, setI] = useState(0);
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-lg font-semibold">Intake panel preview</h1>
      <p className="mt-1 text-xs text-zinc-500">
        Development only. Renders the live{" "}
        <code className="text-zinc-400">ProteinIntakePanel</code> with fabricated test-client
        answers — these are not real clients.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {CLIENTS.map((c, idx) => (
          <button
            key={c.name}
            onClick={() => setI(idx)}
            className={`rounded px-3 py-1.5 text-xs ring-1 ${
              idx === i
                ? "bg-brand/10 text-brand ring-brand/40"
                : "text-zinc-400 ring-zinc-800 hover:text-zinc-200"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-zinc-500">{CLIENTS[i].note}</p>

      <ProteinIntakePanel answers={CLIENTS[i].answers} />
    </main>
  );
}

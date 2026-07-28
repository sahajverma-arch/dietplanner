"use client";

// Development-only preview of the client summary page.
//
// The real page at /counselling/review reads the signed-in dietitian's own
// saved draft, so seeing it otherwise means either completing a consultation
// or seeding a draft onto the exact account the browser happens to be signed
// in as. This renders the SAME component with the finished test clients, for
// whoever is signed in.
//
// notFound() in any non-development build: this bypasses no authentication
// (the middleware still guards the route), but a page whose whole purpose is
// showing fabricated client data has no business existing in production.
// Generating is disabled here — the preview must never create a client row.

import { useState } from "react";
import { notFound } from "next/navigation";
import ClientDossier from "@/components/ClientDossier";
import type { Answers } from "@/lib/counselling/questions";
import { PRIYA, RAHUL, SNEHA, AADI } from "../../../../scripts/test-clients";

const CLIENTS: { name: string; note: string; answers: Answers }[] = [
  { name: "Priya", note: "32F vegetarian · PCOS + hypothyroid · severe peanut allergy", answers: PRIYA as Answers },
  { name: "Rahul", note: "non-vegetarian · trains · no meat on Tue/Thu", answers: RAHUL as Answers },
  { name: "Sneha", note: "highest fat share of the four", answers: SNEHA as Answers },
  { name: "Aadi", note: "highest carb intake · post-workout protein", answers: AADI as Answers },
];

export default function ClientSummaryPreviewPage() {
  // Hook first: an early return above it would break the rules of hooks.
  const [i, setI] = useState(0);
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <h1 className="text-sm font-semibold text-amber-400">
          Client summary preview — development only
        </h1>
        <p className="mt-1 text-xs text-zinc-400">
          The live page is <code className="text-zinc-300">/counselling/review</code>, reached from
          the bottom of the counselling form. These four are fabricated test clients, not real
          people, and the generate button is disabled.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {CLIENTS.map((c, idx) => (
            <button
              key={c.name}
              type="button"
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
      </div>

      <ClientDossier key={CLIENTS[i].name} answers={CLIENTS[i].answers} appointmentId={null} preview />
    </main>
  );
}

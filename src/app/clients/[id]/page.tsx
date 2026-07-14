import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import FollowUpForm from "@/components/FollowUpForm";
import PlanView from "@/components/PlanView";
import DownloadPdfButton from "@/components/DownloadPdfButton";
import RegenerateButton from "@/components/RegenerateButton";
import { AiReviewSchema, DietPlanSchema, isPauseDecision } from "@/lib/nim";
import type { ClientRow, DietPlanRow } from "@/lib/types";

export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function ClientPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", params.id)
    .maybeSingle<ClientRow>();
  if (!client) notFound();

  const { data: plans } = await supabase
    .from("diet_plans")
    .select("*")
    .eq("client_id", client.id)
    .order("week_number", { ascending: false })
    .returns<DietPlanRow[]>();

  const planRows = plans ?? [];
  const latest = planRows[0] ?? null;
  const parsedLatest = latest ? DietPlanSchema.safeParse(latest.plan) : null;
  const latestPlan = parsedLatest?.success ? parsedLatest.data : null;
  const parsedReview = latest?.ai_review ? AiReviewSchema.safeParse(latest.ai_review) : null;
  const aiReview = parsedReview?.success ? parsedReview.data : null;

  const facts: [string, string][] = [
    ["Age", client.age ? String(client.age) : "—"],
    ["Gender", client.gender || "—"],
    ["Height", client.height_cm ? `${client.height_cm} cm` : "—"],
    ["Weight", client.weight_kg ? `${client.weight_kg} kg` : "—"],
    ["Diet", client.diet_type || "—"],
    ["Goal", client.goal || "—"],
  ];

  return (
    <div className="min-h-screen">
      <AppHeader email={user.email ?? ""} />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Link href="/" className="text-sm font-medium text-brand hover:underline">
          ← Back to dashboard
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-xl font-bold text-brand">
              {client.full_name.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{client.full_name}</h1>
              <p className="text-sm text-zinc-400">
                Client since {formatDate(client.created_at)}
                {latest ? ` · currently on Week ${latest.week_number}` : ""}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {facts.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                {label}
              </div>
              <div className="truncate text-sm font-semibold capitalize">{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {latestPlan && latest ? (
              <PlanView
                plan={latestPlan}
                weekNumber={latest.week_number}
                createdAt={formatDate(latest.created_at)}
              />
            ) : (
              <div className="card text-center">
                <h2 className="text-lg font-semibold">No diet plan yet</h2>
                <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-400">
                  The first plan hasn&apos;t been generated (or generation failed). You can
                  retry using the saved counselling data.
                </p>
                <RegenerateButton clientId={client.id} />
              </div>
            )}

            {aiReview && latest && (
              <div className="card">
                <h2 className="text-base font-semibold">
                  AI independent clinical review · Week {latest.week_number}
                </h2>
                <p
                  className={`mt-1.5 inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                    isPauseDecision(aiReview)
                      ? "bg-red-500/15 text-red-400"
                      : "bg-brand/15 text-brand"
                  }`}
                >
                  {aiReview.decision}
                </p>
                <p className="mt-2 text-sm text-zinc-400">{aiReview.reasoning}</p>
                {aiReview.strategy_adjustments.length > 0 && (
                  <div className="mt-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Strategy adjustments applied
                    </h3>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-zinc-300">
                      {aiReview.strategy_adjustments.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {aiReview.safety_concerns.length > 0 && (
                  <div className="mt-3 rounded bg-red-500/10 px-3 py-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-red-400">
                      Safety concerns respected
                    </h3>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-zinc-300">
                      {aiReview.safety_concerns.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {planRows.length > 0 && (
              <div className="card">
                <h2 className="mb-3 text-base font-semibold">Plan history</h2>
                <ul className="divide-y divide-zinc-800">
                  {planRows.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div>
                        <div className="text-sm font-semibold">Week {p.week_number}</div>
                        <div className="text-xs text-zinc-500">
                          {p.source === "first_counselling" ? "First counselling" : "Follow-up"} ·{" "}
                          {formatDate(p.created_at)}
                        </div>
                      </div>
                      {p.pdf_path && <DownloadPdfButton path={p.pdf_path} />}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <FollowUpForm
              clientId={client.id}
              nextWeek={(latest?.week_number ?? 0) + 1}
              lastWeightKg={client.weight_kg}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import ClientDossier from "@/components/ClientDossier";
import type { Answers } from "@/lib/counselling/questions";
import { QUICK_INTAKE_DRAFT_KIND } from "@/lib/counselling/quick-intake";

/**
 * The client summary, between the counselling and the plan.
 *
 * Reads the counselling draft rather than a client record, because no client
 * exists yet — the row is only created when the dietitian generates from here.
 * A consultation that ends without a plan therefore leaves nothing behind but
 * the draft it started with.
 *
 * Shared by both counselling forms — the full form's drafts live under kind
 * "first_counselling", the quick form's under "quick_counselling" (kept
 * separate so neither form can inherit the other's draft for the same
 * appointment slot). Ordered by recency rather than .maybeSingle() because
 * both could in principle exist for the same appointment if a dietitian
 * started one form and then switched to the other without finishing either.
 */
export const dynamic = "force-dynamic";

export default async function CounsellingReviewPage({
  searchParams,
}: {
  searchParams?: { appointment?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const appointmentId = searchParams?.appointment ?? null;

  const [{ data: drafts }, { data: me }] = await Promise.all([
    supabase
      .from("form_drafts")
      .select("data")
      .eq("dietitian_id", user.id)
      .in("kind", ["first_counselling", QUICK_INTAKE_DRAFT_KIND])
      .eq("appointment_id", appointmentId ?? "")
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);

  const saved = (drafts?.[0]?.data ?? null) as {
    answers?: Answers;
    appointmentId?: string | null;
  } | null;

  // Nothing to summarise — send them back to the form rather than showing an
  // empty page of dashes.
  if (!saved?.answers || Object.keys(saved.answers).length === 0) {
    redirect(appointmentId ? `/counselling/new?appointment=${appointmentId}` : "/counselling/new");
  }

  return (
    <div className="min-h-screen">
      <AppHeader email={user.email ?? ""} isAdmin={me?.role === "admin"} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <ClientDossier answers={saved.answers} appointmentId={appointmentId} />
      </main>
    </div>
  );
}

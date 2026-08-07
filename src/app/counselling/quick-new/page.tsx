import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import QuickCounsellingForm from "@/components/QuickCounsellingForm";
import AppHeader from "@/components/AppHeader";
import type { Answers } from "@/lib/counselling/questions";
import { QUICK_INTAKE_DRAFT_KIND } from "@/lib/counselling/quick-intake";

export const dynamic = "force-dynamic";

export default async function QuickNewCounsellingPage({
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

  const [{ data: draft }, { data: me }, { data: appointment }] = await Promise.all([
    supabase
      .from("form_drafts")
      .select("data")
      .eq("dietitian_id", user.id)
      .eq("kind", QUICK_INTAKE_DRAFT_KIND)
      .eq("appointment_id", appointmentId ?? "")
      .maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    appointmentId
      ? supabase
          .from("counselling_appointments")
          .select("client_code, display_name")
          .eq("id", appointmentId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // A quick-intake draft's own namespace (dietitian_id + kind
  // "quick_counselling" + appointment_id) — deliberately separate from the
  // full form's "first_counselling" drafts, so neither form can ever inherit
  // the other's data for the same appointment slot. See quick-intake.ts.
  const saved = (draft?.data ?? null) as { answers?: Answers; appointmentId?: string | null } | null;

  let initialAnswers: Answers | null = saved?.answers ?? null;

  if (!initialAnswers && appointment) {
    initialAnswers = {
      clientCode: appointment.client_code ?? "",
      name: (appointment.display_name ?? "").replace(/\s+[A-Z]-?\d+$/i, "").trim(),
    };
  }

  return (
    <div className="min-h-screen">
      <AppHeader email={user.email ?? ""} isAdmin={me?.role === "admin"} />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <QuickCounsellingForm
          key={appointmentId ?? "new"}
          dietitianId={user.id}
          initialAnswers={initialAnswers}
          appointmentId={appointmentId}
        />
      </main>
    </div>
  );
}

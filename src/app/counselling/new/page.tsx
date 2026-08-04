import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClinicalCounsellingForm from "@/components/ClinicalCounsellingForm";
import AppHeader from "@/components/AppHeader";
import type { Answers } from "@/lib/counselling/questions";

export const dynamic = "force-dynamic";

export default async function NewCounsellingPage({
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
      .eq("kind", "first_counselling")
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

  // The query above is already scoped to this exact appointment (form_drafts
  // is keyed on dietitian_id + kind + appointment_id), so whatever comes back
  // belongs to this counselling and nothing else.
  const saved = (draft?.data ?? null) as { answers?: Answers; appointmentId?: string | null } | null;

  let initialAnswers: Answers | null = saved?.answers ?? null;

  // Seed what the ops sheet already knows about this client.
  if (!initialAnswers && appointment) {
    initialAnswers = {
      clientCode: appointment.client_code ?? "",
      // Sheet names are "Firstname EMPCODE" — take the human part only.
      name: (appointment.display_name ?? "").replace(/\s+[A-Z]-?\d+$/i, "").trim(),
    };
  }

  return (
    <div className="min-h-screen">
      <AppHeader email={user.email ?? ""} isAdmin={me?.role === "admin"} />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <ClinicalCounsellingForm
          key={appointmentId ?? "new"}
          dietitianId={user.id}
          initialAnswers={initialAnswers}
          appointmentId={appointmentId}
        />
      </main>
    </div>
  );
}

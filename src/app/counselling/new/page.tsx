import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CounsellingForm from "@/components/CounsellingForm";
import AppHeader from "@/components/AppHeader";
import type { IntakeForm } from "@/lib/types";

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

  const { data: draft } = await supabase
    .from("form_drafts")
    .select("data")
    .eq("dietitian_id", user.id)
    .eq("kind", "first_counselling")
    .maybeSingle();

  return (
    <div className="min-h-screen">
      <AppHeader email={user.email ?? ""} />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <CounsellingForm
          dietitianId={user.id}
          initialDraft={(draft?.data as IntakeForm) ?? null}
          appointmentId={searchParams?.appointment ?? null}
        />
      </main>
    </div>
  );
}

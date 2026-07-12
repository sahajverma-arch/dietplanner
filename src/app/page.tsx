import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClientCard, { type ClientCardData } from "@/components/ClientCard";
import AppHeader from "@/components/AppHeader";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: clients }, { data: me }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, full_name, goal, diet_type, weight_kg, created_at, diet_plans(week_number, created_at)")
      .eq("dietitian_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
  ]);

  const cards: ClientCardData[] = (clients ?? []).map((c: any) => {
    const plans: { week_number: number; created_at: string }[] = c.diet_plans ?? [];
    const latestWeek = plans.reduce((m, p) => Math.max(m, p.week_number), 0);
    const lastPlanAt = plans.reduce<string | null>(
      (m, p) => (m === null || p.created_at > m ? p.created_at : m),
      null
    );
    return {
      id: c.id,
      fullName: c.full_name,
      goal: c.goal,
      dietType: c.diet_type,
      weightKg: c.weight_kg,
      latestWeek,
      lastPlanAt,
    };
  });

  return (
    <div className="min-h-screen">
      <AppHeader email={user.email ?? ""} isAdmin={me?.role === "admin"} />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Your clients</h1>
            <p className="text-sm text-zinc-400">
              {cards.length} client{cards.length === 1 ? "" : "s"}
            </p>
          </div>
          <Link href="/counselling/new" className="btn-primary">
            <span className="text-lg leading-none">+</span> New Counselling
          </Link>
        </div>

        {cards.length === 0 ? (
          <div className="card flex flex-col items-center py-16 text-center">
            <div className="mb-3 text-4xl">🥗</div>
            <h2 className="text-lg font-semibold">No clients yet</h2>
            <p className="mt-1 max-w-sm text-sm text-zinc-400">
              Start your first counselling session. Fill the form live during the call —
              it autosaves — then generate the Week 1 diet plan on submit.
            </p>
            <Link href="/counselling/new" className="btn-primary mt-5">
              + New Counselling
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <ClientCard key={c.id} client={c} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

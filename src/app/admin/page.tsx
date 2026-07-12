import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";

export const dynamic = "force-dynamic";

// Read-only admin overview: every dietitian (with the employee code / phone
// used for data mapping), every client, and the latest generated plans.
// RLS: the *_select_admin policies (0004) make these queries span all rows
// only when profiles.role = 'admin'; everyone else is redirected.
export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (me?.role !== "admin") redirect("/");

  const [{ data: profiles }, { data: clients }, { data: plans }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, employee_code, phone, role, created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("clients")
      .select("id, dietitian_id, full_name, goal, diet_type, created_at"),
    supabase
      .from("diet_plans")
      .select("id, dietitian_id, client_id, week_number, source, pdf_path, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const dietitians = profiles ?? [];
  const allClients = clients ?? [];
  const allPlans = plans ?? [];

  const clientsByDietitian = new Map<string, number>();
  for (const c of allClients)
    clientsByDietitian.set(c.dietitian_id, (clientsByDietitian.get(c.dietitian_id) ?? 0) + 1);
  const plansByDietitian = new Map<string, number>();
  for (const p of allPlans)
    plansByDietitian.set(p.dietitian_id, (plansByDietitian.get(p.dietitian_id) ?? 0) + 1);

  const nameById = new Map(dietitians.map((d) => [d.id, d.full_name || d.email || "—"]));
  const clientNameById = new Map(allClients.map((c) => [c.id, c.full_name]));

  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const plansThisWeek = allPlans.filter((p) => new Date(p.created_at).getTime() >= weekAgo).length;

  // Signed URLs for the 20 most recent PDFs (1-hour expiry)
  const recent = allPlans.slice(0, 20);
  const pdfUrls = new Map<string, string>();
  await Promise.all(
    recent
      .filter((p) => p.pdf_path)
      .map(async (p) => {
        const { data } = await supabase.storage
          .from("diet-pdfs")
          .createSignedUrl(p.pdf_path as string, 3600);
        if (data?.signedUrl) pdfUrls.set(p.id, data.signedUrl);
      })
  );

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="min-h-screen">
      <AppHeader email={user.email ?? ""} isAdmin />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Admin overview</h1>
            <p className="text-sm text-zinc-400">Read-only view across the whole team</p>
          </div>
          <Link href="/" className="btn-secondary">← My clients</Link>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["Dietitians", dietitians.filter((d) => d.role !== "admin").length],
            ["Clients", allClients.length],
            ["Plans generated", allPlans.length],
            ["Plans this week", plansThisWeek],
          ].map(([label, value]) => (
            <div key={label} className="card">
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs uppercase tracking-wide text-zinc-400">{label}</div>
            </div>
          ))}
        </div>

        {/* Team */}
        <h2 className="mb-3 text-lg font-semibold">Team</h2>
        <div className="card mb-8 overflow-x-auto !p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-400">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Emp. code</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-right">Clients</th>
                <th className="px-4 py-3 text-right">Plans</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {dietitians.map((d) => (
                <tr key={d.id} className="border-b border-zinc-800/50">
                  <td className="px-4 py-3 font-medium">{d.full_name || "—"}</td>
                  <td className="px-4 py-3 text-zinc-400">{d.email || "—"}</td>
                  <td className="px-4 py-3">{d.employee_code || <span className="text-amber-400">pending</span>}</td>
                  <td className="px-4 py-3 text-zinc-400">{d.phone || "—"}</td>
                  <td className="px-4 py-3">
                    {d.role === "admin" ? (
                      <span className="rounded bg-brand/15 px-2 py-0.5 text-xs font-semibold text-brand">admin</span>
                    ) : (
                      <span className="text-zinc-400">dietitian</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{clientsByDietitian.get(d.id) ?? 0}</td>
                  <td className="px-4 py-3 text-right">{plansByDietitian.get(d.id) ?? 0}</td>
                  <td className="px-4 py-3 text-zinc-400">{fmt(d.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent plans */}
        <h2 className="mb-3 text-lg font-semibold">Recent diet plans</h2>
        <div className="card overflow-x-auto !p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-400">
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Dietitian</th>
                <th className="px-4 py-3">Week</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Generated</th>
                <th className="px-4 py-3 text-right">PDF</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                    No plans generated yet.
                  </td>
                </tr>
              )}
              {recent.map((p) => (
                <tr key={p.id} className="border-b border-zinc-800/50">
                  <td className="px-4 py-3 font-medium">{clientNameById.get(p.client_id) ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-400">{nameById.get(p.dietitian_id) ?? "—"}</td>
                  <td className="px-4 py-3">Week {p.week_number}</td>
                  <td className="px-4 py-3 text-zinc-400">
                    {p.source === "first_counselling" ? "First plan" : "Follow-up"}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{fmt(p.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {pdfUrls.get(p.id) ? (
                      <a
                        href={pdfUrls.get(p.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand hover:underline"
                      >
                        Open
                      </a>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

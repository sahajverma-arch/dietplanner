import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";

export const dynamic = "force-dynamic";

// "Today's Activity" — the counselling calls scheduled today (IST) for the
// signed-in dietitian, matched by profiles.employee_code = emp_code from the
// synced ops sheet. All sheet columns, plus our workflow status and a
// Start Counselling action that opens the intake form.

function istTodayRange(): { start: string; endExclusive: string; label: string } {
  const IST_OFFSET_MS = 5.5 * 3600 * 1000;
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);
  const day = nowIst.toISOString().slice(0, 10);
  const next = new Date(nowIst.getTime() + 24 * 3600 * 1000).toISOString().slice(0, 10);
  const label = nowIst.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC", // nowIst is already shifted; avoid double conversion
  });
  return { start: `${day} 00:00:00`, endExclusive: `${next} 00:00:00`, label };
}

const time = (ts: string) => ts.slice(11, 16);
const date = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");

export default async function TodayPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("employee_code, role")
    .eq("id", user.id)
    .maybeSingle();

  const { start, endExclusive, label } = istTodayRange();

  const { data: appts } = await supabase
    .from("counselling_appointments")
    .select("*")
    .eq("emp_code", (me?.employee_code ?? "").toUpperCase())
    .gte("scheduled_on", start)
    .lt("scheduled_on", endExclusive)
    .order("scheduled_on", { ascending: true });

  const rows = appts ?? [];
  const done = rows.filter((r) => r.status === "completed").length;

  return (
    <div className="min-h-screen">
      <AppHeader email={user.email ?? ""} isAdmin={me?.role === "admin"} />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Today&apos;s Activity</h1>
            <p className="text-sm text-zinc-400">
              {label} · {rows.length} counselling{rows.length === 1 ? "" : "s"} scheduled
              {rows.length > 0 ? ` · ${done} completed` : ""}
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="card flex flex-col items-center py-16 text-center">
            <div className="mb-3 text-4xl">📅</div>
            <h2 className="text-lg font-semibold">Nothing scheduled today</h2>
            <p className="mt-1 max-w-sm text-sm text-zinc-400">
              Counsellings assigned to your employee code
              {me?.employee_code ? ` (${me.employee_code})` : ""} will appear here after the
              daily sheet sync.
            </p>
          </div>
        ) : (
          <div className="card overflow-x-auto !p-0">
            <table className="w-full whitespace-nowrap text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-400">
                  <th className="px-3 py-3">Time</th>
                  <th className="px-3 py-3">Client Code</th>
                  <th className="px-3 py-3">Display Name</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Sheet Status</th>
                  <th className="px-3 py-3">Counselling Date</th>
                  <th className="px-3 py-3">Emp Code</th>
                  <th className="px-3 py-3">First Call</th>
                  <th className="px-3 py-3">Call Date</th>
                  <th className="px-3 py-3">Talktime</th>
                  <th className="px-3 py-3">Plan Name</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-b border-zinc-800/50">
                    <td className="px-3 py-3 font-semibold">{time(a.scheduled_on)}</td>
                    <td className="px-3 py-3">{a.client_code}</td>
                    <td className="px-3 py-3 text-zinc-400">{a.display_name ?? "—"}</td>
                    <td className="px-3 py-3">
                      <span
                        className={
                          a.category === "DIET"
                            ? "rounded bg-brand/15 px-2 py-0.5 text-xs font-semibold text-brand"
                            : "rounded bg-sky-500/15 px-2 py-0.5 text-xs font-semibold text-sky-400"
                        }
                      >
                        {a.category ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-zinc-400">{a.sheet_status ?? "—"}</td>
                    <td className="px-3 py-3 text-zinc-400">{date(a.counselling_date)}</td>
                    <td className="px-3 py-3 text-zinc-400">{a.emp_code}</td>
                    <td className="px-3 py-3 text-zinc-400">
                      {a.first_call ? `${date(a.first_call)} ${time(a.first_call)}` : "—"}
                    </td>
                    <td className="px-3 py-3 text-zinc-400">{date(a.call_date)}</td>
                    <td className="px-3 py-3 text-zinc-400">
                      {a.talktime ? `${Math.round(a.talktime / 60)} min` : "—"}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-3 text-zinc-400" title={a.plan_name ?? ""}>
                      {a.plan_name ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-zinc-400">{a.plan_type ?? "—"}</td>
                    <td className="px-3 py-3">
                      {a.status === "completed" ? (
                        <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                          Completed
                        </span>
                      ) : (
                        <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-400">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {a.status === "completed" && a.client_id ? (
                        <Link href={`/clients/${a.client_id}`} className="text-brand hover:underline">
                          View client
                        </Link>
                      ) : (
                        <Link
                          href={`/counselling/new?appointment=${a.id}`}
                          className="btn-primary !px-3 !py-1.5 text-xs"
                        >
                          Start Counselling
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

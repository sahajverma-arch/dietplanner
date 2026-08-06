import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import ExchangePlanTester from "@/components/ExchangePlanTester";

export const dynamic = "force-dynamic";

// Development-only preview of the exchange-list solver (src/lib/exchange-plan.ts)
// and its seeded data (migration 0012, scripts/seed-food-exchanges.mjs).
//
// Not part of the plan-generation pipeline yet — nim.ts, nutrition.ts and
// roadmap.ts are all untouched. This exists so the seeded data and the
// solver's output can be checked by eye before either is wired into a real
// client's plan.
//
// notFound() in any non-development build: this bypasses no authentication
// (the middleware still guards the route, and reading food_exchange_groups
// still goes through RLS as whichever dietitian is signed in), but a page
// whose whole purpose is previewing DRAFT, not-clinically-reviewed data has
// no business existing in production — same reasoning as the other /dev pages.
export default async function ExchangePlanPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: groups, error: groupsError }, { data: foods, error: foodsError }] = await Promise.all([
    supabase.from("food_exchange_groups").select("*").order("sort_order"),
    supabase.from("food_exchanges").select("*").order("group_id").order("name"),
  ]);

  const foodsByGroup = new Map<string, typeof foods>();
  for (const f of foods ?? []) {
    const list = foodsByGroup.get(f.group_id) ?? [];
    list.push(f);
    foodsByGroup.set(f.group_id, list);
  }

  return (
    <div className="min-h-screen">
      <AppHeader email={user.email ?? ""} />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold">Exchange list — preview</h1>
          <p className="text-sm text-zinc-400">
            Development only. DRAFT data, not clinically reviewed. Not wired into plan generation yet.
          </p>
        </div>

        {(groupsError || foodsError) && (
          <div className="card mb-8 border-red-900 bg-red-500/10 text-sm text-red-300">
            <p className="font-semibold">Couldn&apos;t load seeded data.</p>
            {groupsError && <p>food_exchange_groups: {groupsError.message}</p>}
            {foodsError && <p>food_exchanges: {foodsError.message}</p>}
            <p className="mt-2 text-red-400">
              Run <code className="rounded bg-black/30 px-1">npm run seed:food-exchanges</code> if migration 0012
              has been applied but the tables are still empty.
            </p>
          </div>
        )}

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["Groups seeded", groups?.length ?? 0],
            ["Foods seeded", foods?.length ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="card">
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs uppercase tracking-wide text-zinc-400">{label}</div>
            </div>
          ))}
        </div>

        <h2 className="mb-3 text-lg font-semibold">Solver tester</h2>
        <p className="mb-4 text-sm text-zinc-400">
          Enter a day&apos;s target (from a roadmap week — e.g. <code>weekTargets(roadmap, week)</code>) and see the
          exchange counts <code>exchangePlanFor()</code> produces, computed live in your browser — no server round
          trip, since the solver is pure.
        </p>
        <ExchangePlanTester />

        <h2 className="mb-3 mt-10 text-lg font-semibold">Seeded exchange groups &amp; foods</h2>
        <div className="space-y-6">
          {(groups ?? []).map((g) => (
            <div key={g.id} className="card">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">{g.label}</h3>
                <span className="text-xs text-zinc-400">
                  anchor: {g.kcal} kcal · P{g.protein_g} C{g.carbs_g} F{g.fat_g} Fib{g.fiber_g} ·{" "}
                  {g.protein_per_100kcal} P/100kcal · {g.standard_serving}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-400">
                      <th className="py-2 pr-4">Food</th>
                      <th className="py-2 pr-4">Serving</th>
                      <th className="py-2 pr-4 text-right">P</th>
                      <th className="py-2 pr-4 text-right">C</th>
                      <th className="py-2 pr-4 text-right">F</th>
                      <th className="py-2 pr-4 text-right">Fib</th>
                      <th className="py-2 pr-4 text-right">kcal</th>
                      <th className="py-2 pr-4">Diet tags</th>
                      <th className="py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(foodsByGroup.get(g.id) ?? []).map((f) => (
                      <tr key={f.id} className="border-b border-zinc-800/50">
                        <td className="py-2 pr-4 font-medium">{f.name}</td>
                        <td className="py-2 pr-4 text-zinc-400">{f.household_measure || `${f.serving_g} g`}</td>
                        <td className="py-2 pr-4 text-right">{f.protein_g}</td>
                        <td className="py-2 pr-4 text-right">{f.carbs_g}</td>
                        <td className="py-2 pr-4 text-right">{f.fat_g}</td>
                        <td className="py-2 pr-4 text-right">{f.fiber_g}</td>
                        <td className="py-2 pr-4 text-right">{f.kcal}</td>
                        <td className="py-2 pr-4 text-zinc-500">{(f.diet_tags ?? []).join(", ") || "—"}</td>
                        <td className="py-2 text-zinc-500">{f.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

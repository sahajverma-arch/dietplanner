import type { DietPlan } from "@/lib/nim";

export default function PlanView({
  plan,
  weekNumber,
  createdAt,
  draft = false,
}: {
  plan: DietPlan;
  weekNumber: number;
  createdAt: string;
  draft?: boolean;
}) {
  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          Week {weekNumber} plan
          {draft && (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-400">
              Draft preview
            </span>
          )}
        </h2>
        <span className="text-xs text-zinc-500">Generated {createdAt}</span>
      </div>

      <p className="mt-3 rounded-lg border border-brand/20 bg-brand/5 p-3 text-sm leading-relaxed text-zinc-200">
        {plan.summary}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Calories/day" value={`${Math.round(plan.daily_calories)} kcal`} />
        <Stat label="Protein" value={`${Math.round(plan.macros.protein_g)} g`} />
        <Stat label="Carbs" value={`${Math.round(plan.macros.carbs_g)} g`} />
        <Stat label="Fat" value={`${Math.round(plan.macros.fat_g)} g`} />
      </div>

      {plan.guidelines.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-zinc-300">Guidelines</h3>
          <ul className="space-y-1 text-sm text-zinc-400">
            {plan.guidelines.map((g, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-brand">•</span>
                <span>{g}</span>
              </li>
            ))}
            {plan.hydration && (
              <li className="flex gap-2">
                <span className="text-brand">•</span>
                <span>Hydration: {plan.hydration}</span>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="mt-4 space-y-2">
        <h3 className="text-sm font-semibold text-zinc-300">Meals</h3>
        {plan.days.map((day, di) => (
          <details
            key={di}
            className="group rounded-lg border border-zinc-800"
            open={di === 0}
          >
            <summary className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold hover:bg-zinc-800">
              <span>{day.day}</span>
              <span className="flex items-center gap-2 text-xs font-normal text-zinc-500">
                {day.total_calories ? `~${Math.round(day.total_calories)} kcal` : ""}
                <span className="transition group-open:rotate-180">▾</span>
              </span>
            </summary>
            <div className="divide-y divide-zinc-800 border-t border-zinc-800">
              {day.meals.map((meal, mi) => (
                <div key={mi} className="flex gap-3 px-3 py-2.5">
                  <div className="w-28 shrink-0">
                    <div className="text-sm font-medium">{meal.name}</div>
                    {meal.time && <div className="text-xs text-zinc-500">{meal.time}</div>}
                  </div>
                  <div className="min-w-0 flex-1 text-sm text-zinc-300">
                    {meal.items.map((item, ii) => (
                      <div key={ii}>
                        {item.food}
                        {item.quantity ? ` — ${item.quantity}` : ""}
                      </div>
                    ))}
                    {meal.notes && (
                      <div className="mt-0.5 text-xs italic text-zinc-500">{meal.notes}</div>
                    )}
                  </div>
                  {(meal.calories || 0) > 0 && (
                    <div className="shrink-0 text-right text-xs">
                      <div className="font-semibold text-zinc-300">
                        {Math.round(meal.calories)} kcal
                      </div>
                      <div className="mt-0.5 text-zinc-500">
                        <span className="text-sky-400">P {Math.round(meal.protein_g)}</span>
                        {" · "}
                        <span className="text-amber-400">C {Math.round(meal.carbs_g)}</span>
                        {" · "}
                        <span className="text-red-400">F {Math.round(meal.fat_g)}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>

      {plan.foods_to_avoid.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-zinc-300">Foods to avoid</h3>
          <div className="flex flex-wrap gap-1.5">
            {plan.foods_to_avoid.map((f, i) => (
              <span
                key={i}
                className="rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-800 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}

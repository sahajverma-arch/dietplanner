// End-to-end test of per-meal editing: a saved draft plan → generateMealAlternates()
// (NVIDIA NIM + forbidden-food/diet-type/weekday enforcement) → groundMeals()
// (exchange-list foods table). Exactly the code path of POST /api/plan-meal
// {type:"alternates"}, minus the authenticated HTTP wrapper and the DB write.
//
// Run:  npx -y tsx scripts/test-meal-alternates.ts
//       ALT_CLIENT=priya-test ALT_MEALS=0:1,2:3 npx -y tsx scripts/test-meal-alternates.ts
//
// ALT_MEALS is a comma-separated list of dayIndex:mealIndex pairs (default 0:1).

import { readFileSync } from "node:fs";
import path from "node:path";
import { PRIYA, RAHUL, SNEHA, AADI, type Answers } from "./test-clients";

// .env.local must be in process.env BEFORE the libs are imported (nim.ts reads
// NVIDIA_MODEL at module load), hence the dynamic imports in main().
const envPath = path.join(__dirname, "..", ".env.local");
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

const CLIENTS: Record<string, Answers> = {
  "priya-test": PRIYA,
  "rahul-test": RAHUL,
  "sneha-test": SNEHA,
  "aadi-test": AADI,
};

async function main() {
  const { toIntake } = await import("../src/lib/counselling/assessment");
  const { DietPlanSchema, generateMealAlternates, mealRuleIssues } = await import("../src/lib/nim");
  const { groundMeals } = await import("../src/lib/nutrition");
  const { createClient } = await import("@supabase/supabase-js");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const slug = process.env.ALT_CLIENT ?? "aadi-test";
  const answers = CLIENTS[slug];
  if (!answers) throw new Error(`Unknown client "${slug}" — one of ${Object.keys(CLIENTS).join(", ")}`);

  const planPath = path.join(__dirname, "..", "test-output", `${slug}-week1.plan.json`);
  const raw = JSON.parse(readFileSync(planPath, "utf8"));
  const plan = DietPlanSchema.parse(raw.plan ?? raw);
  const intake = toIntake(answers);
  // Same convention as generation: Day 1 is tomorrow.
  const startsOn = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  const targets = (process.env.ALT_MEALS ?? "0:1")
    .split(",")
    .map((pair) => pair.split(":").map((n) => parseInt(n, 10)) as [number, number]);

  const itemLine = (items: { food: string; quantity: string }[]) =>
    items.map((i) => (i.quantity ? `${i.food} (${i.quantity})` : i.food)).join(", ");

  let failures = 0;

  for (const [dayIndex, mealIndex] of targets) {
    const day = plan.days[dayIndex];
    const meal = day?.meals[mealIndex];
    if (!meal) {
      console.error(`!! no meal at ${dayIndex}:${mealIndex}`);
      failures++;
      continue;
    }

    console.log(`\n================ ${slug} · ${day.day} ${meal.name} ================`);
    console.log(`current: ${itemLine(meal.items)}`);
    console.log(
      `         ${Math.round(meal.calories)} kcal · P ${Math.round(meal.protein_g)} · C ${Math.round(meal.carbs_g)} · F ${Math.round(meal.fat_g)}`
    );

    const t0 = Date.now();
    const alternates = await generateMealAlternates({
      intake,
      week: 1,
      plan,
      dayIndex,
      mealIndex,
      startsOn,
    });
    const { meals: grounded } = await groundMeals(
      supabase,
      alternates.map((a) => ({ ...meal, ...a, alternates: [] }))
    );
    console.log(`\n${grounded.length} alternatives in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

    for (let i = 0; i < grounded.length; i++) {
      const a = grounded[i];
      // The route re-checks every option before storing it — so does this.
      const issues = mealRuleIssues({
        intake,
        plan,
        dayIndex,
        meals: [{ ...meal, ...a }],
        startsOn,
      });
      const kcalOff = meal.calories > 0
        ? Math.round(((a.calories - meal.calories) / meal.calories) * 100)
        : 0;
      const proteinShort = a.protein_g < meal.protein_g - 3;
      if (issues.length > 0) failures++;

      console.log(
        `  ${i + 1}. ${itemLine(a.items)}\n` +
          `     ${Math.round(a.calories)} kcal (${kcalOff >= 0 ? "+" : ""}${kcalOff}%) · ` +
          `P ${Math.round(a.protein_g)}${proteinShort ? " ⚠ under the meal it replaces" : ""} · ` +
          `C ${Math.round(a.carbs_g)} · F ${Math.round(a.fat_g)}` +
          (issues.length ? `\n     !! RULE BREACH: ${issues.join("; ")}` : "")
      );
    }
  }

  console.log(
    failures === 0
      ? `\nall alternatives are rule-safe`
      : `\n${failures} PROBLEM(S) — see the breaches above`
  );
  // exitCode, not exit(): the Supabase/NIM keep-alive sockets are still open,
  // and tearing them down mid-flight crashes libuv on Windows ("Assertion
  // failed: !(handle->flags & UV_HANDLE_CLOSING)") — which reports a passing
  // run as a failure.
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

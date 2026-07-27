// Times each generation step on its own. This is the go/no-go for stepped
// generation on a host that kills a function at 60s: the average is
// irrelevant, the SLOWEST single step decides whether the design works.
//
// Run: npx -y tsx scripts/bench-plan-steps.ts [client]

import { readFileSync } from "node:fs";
import path from "node:path";
import { PRIYA, RAHUL, SNEHA, AADI, type Answers } from "./test-clients";
// Type-only, so it is erased and does not load nim.ts before .env.local is read.
import type { DietPlan } from "../src/lib/nim";

const envPath = path.join(__dirname, "..", ".env.local");
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

const CLIENTS: Record<string, Answers> = {
  priya: PRIYA, rahul: RAHUL, sneha: SNEHA, aadi: AADI,
};

const LIMIT_S = 60; // the Vercel Hobby function ceiling

async function main() {
  const slug = (process.argv[2] || "aadi").toLowerCase();
  const { toIntake } = await import("../src/lib/counselling/assessment");
  const { aiClinicalReview, generatePlanOverview, generatePlanDays, assemblePlan, DAY_BATCHES } =
    await import("../src/lib/nim");
  const { groundPlan } = await import("../src/lib/nutrition");
  const { createClient } = await import("@supabase/supabase-js");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const intake = toIntake(CLIENTS[slug]);
  const startsOn = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  const timings: { step: string; secs: number }[] = [];
  const time = async <T>(step: string, fn: () => Promise<T>): Promise<T> => {
    const t0 = Date.now();
    const out = await fn();
    const secs = (Date.now() - t0) / 1000;
    timings.push({ step, secs });
    const flag = secs > LIMIT_S ? "  !! OVER THE 60s LIMIT" : "";
    console.log(`  ${step.padEnd(22)} ${secs.toFixed(1).padStart(6)}s${flag}`);
    return out;
  };

  console.log(`\ntiming each step for ${slug} (limit ${LIMIT_S}s per request)\n`);

  const review = await time("clinical review", () => aiClinicalReview(intake));
  const ctx = { intake, week: 1, review, startsOn };
  const overview = await time("overview", () => generatePlanOverview(ctx));

  const days: DietPlan["days"] = [];
  for (const names of DAY_BATCHES) {
    const batch = await time(names.join("+"), () =>
      generatePlanDays(ctx, overview, names, days)
    );
    days.push(...batch);
  }

  const plan = assemblePlan(ctx, overview, days);
  await time("ground (db only)", () => groundPlan(supabase, plan));

  const worst = timings.reduce((a, b) => (b.secs > a.secs ? b : a));
  const total = timings.reduce((s, t) => s + t.secs, 0);
  console.log(
    `\n  total ${total.toFixed(1)}s across ${timings.length} steps` +
      `\n  slowest step: ${worst.step} at ${worst.secs.toFixed(1)}s`
  );
  console.log(
    worst.secs > LIMIT_S
      ? `\n  FAILS: a step exceeds ${LIMIT_S}s — batches must be split smaller`
      : `\n  FITS: every step is inside ${LIMIT_S}s (headroom ${(LIMIT_S - worst.secs).toFixed(1)}s)`
  );
  process.exitCode = worst.secs > LIMIT_S ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

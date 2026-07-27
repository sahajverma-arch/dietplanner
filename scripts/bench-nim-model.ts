// Benchmarks ONE NIM model on the real Week-1 generation workload, so a model
// swap is decided by evidence rather than by the model card. The long
// review-laden prompt is where models fail: they truncate, fence the JSON, or
// drop days — all of which cost a retry (or the whole plan).
//
// The fallback is pinned to the model under test, so nothing is masked: what
// you see is that model alone.
//
// Run:  NVIDIA_MODEL=meta/llama-3.3-70b-instruct npx -y tsx scripts/bench-nim-model.ts
//       BENCH_CLIENT=priya-test  (default aadi-test)

import { readFileSync } from "node:fs";
import path from "node:path";
import { PRIYA, RAHUL, SNEHA, AADI, type Answers } from "./test-clients";

const envPath = path.join(__dirname, "..", ".env.local");
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
// One model, no safety net — a fallback would hide exactly what we're measuring.
process.env.NVIDIA_FALLBACK_MODEL = process.env.NVIDIA_MODEL;

const CLIENTS: Record<string, Answers> = {
  "priya-test": PRIYA,
  "rahul-test": RAHUL,
  "sneha-test": SNEHA,
  "aadi-test": AADI,
};

// Retries are only reported through console.warn, so they are counted here.
let retries = 0;
const warn = console.warn;
console.warn = (...args: unknown[]) => {
  const text = args.map(String).join(" ");
  if (/validation attempt|was cut off|not valid|violates/i.test(text)) retries++;
  warn(...args);
};

async function main() {
  const model = process.env.NVIDIA_MODEL!;
  const slug = process.env.BENCH_CLIENT ?? "aadi-test";
  const { toIntake } = await import("../src/lib/counselling/assessment");
  const { generateDietPlan } = await import("../src/lib/nim");

  const intake = toIntake(CLIENTS[slug]);
  const startsOn = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

  console.log(`\n---- ${model} · ${slug} ----`);
  const t0 = Date.now();
  try {
    const plan = await generateDietPlan({ intake, week: 1, startsOn });
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const meals = plan.days.reduce((s, d) => s + d.meals.length, 0);
    const kcal = plan.days.map((d) => Math.round(d.total_calories ?? 0));
    const named = plan.days.flatMap((d) => d.meals.flatMap((m) => m.items)).length;
    console.log(
      `RESULT ok model=${model} secs=${secs} retries=${retries} ` +
        `days=${plan.days.length} meals=${meals} items=${named} ` +
        `target=${Math.round(plan.daily_calories)}kcal/P${Math.round(plan.macros.protein_g)} ` +
        `days_kcal=[${kcal.join(",")}]`
    );
  } catch (e) {
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(
      `RESULT FAILED model=${model} secs=${secs} retries=${retries} ` +
        `error=${e instanceof Error ? e.message : e}`
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

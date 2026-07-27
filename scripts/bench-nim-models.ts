// Runs bench-nim-model.ts across several models CONCURRENTLY and prints a
// league table, so a model swap is decided in one pass instead of a dozen
// sequential four-minute waits.
//
// One child process per model, because nim.ts reads NVIDIA_MODEL once at module
// load. Concurrency is capped: different models sit behind different NIM worker
// pools, but stampeding one account still earns 503 "worker local total request
// limit reached".
//
// Run:  npx -y tsx scripts/bench-nim-models.ts
//       BENCH_MODELS=a,b BENCH_CONCURRENCY=2 NVIDIA_TIMEOUT_MS=300000 npx -y tsx scripts/bench-nim-models.ts

import { spawn } from "node:child_process";
import path from "node:path";

const DEFAULT_MODELS = [
  "nvidia/llama-3.3-nemotron-super-49b-v1",
  "meta/llama-3.1-70b-instruct",
  "meta/llama-3.1-8b-instruct",
  "openai/gpt-oss-120b",
  "nvidia/nemotron-3-super-120b-a12b",
];

const models = (process.env.BENCH_MODELS ?? DEFAULT_MODELS.join(",")).split(",").map((s) => s.trim());
const concurrency = Number(process.env.BENCH_CONCURRENCY) || 3;
const script = path.join(__dirname, "bench-nim-model.ts");

type Row = { model: string; line: string; secs: number; ok: boolean };

function run(model: string): Promise<Row> {
  return new Promise((resolve) => {
    // tsx is not a project dependency — it is fetched by npx, as everywhere
    // else in scripts/. shell:true is required for npx on Windows.
    const child = spawn("npx", ["-y", "tsx", script], {
      env: { ...process.env, NVIDIA_MODEL: model },
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });
    let out = "";
    child.stdout.on("data", (b) => (out += b));
    child.stderr.on("data", (b) => (out += b));
    child.on("close", () => {
      const line = out.split(/\r?\n/).find((l) => l.includes("RESULT")) ?? "RESULT (no output)";
      const secs = Number(/secs=([\d.]+)/.exec(line)?.[1] ?? 0);
      resolve({ model, line: line.trim(), secs, ok: line.includes("RESULT ok") });
    });
  });
}

async function main() {
  console.log(
    `benchmarking ${models.length} model(s), concurrency ${concurrency}, ` +
      `timeout ${process.env.NVIDIA_TIMEOUT_MS ?? "120000"}ms\n`
  );
  const rows: Row[] = [];
  for (let i = 0; i < models.length; i += concurrency) {
    const batch = models.slice(i, i + concurrency);
    console.log(`-> ${batch.join(", ")}`);
    const done = await Promise.all(batch.map(run));
    for (const r of done) {
      console.log(`   ${r.line}`);
      rows.push(r);
    }
  }

  const winners = rows.filter((r) => r.ok).sort((a, b) => a.secs - b.secs);
  console.log(`\n================ league table ================`);
  for (const r of winners) console.log(`  OK    ${r.secs.toFixed(1).padStart(6)}s  ${r.model}`);
  for (const r of rows.filter((r) => !r.ok)) console.log(`  FAIL          ${r.model}`);
  console.log(
    winners.length
      ? `\nfastest working model: ${winners[0].model}`
      : `\nNO model produced a valid plan — the endpoint is degraded, not the models`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

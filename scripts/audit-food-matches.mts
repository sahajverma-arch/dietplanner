// QA tool: audits every food item name used across ALL saved diet plans (and
// any plan JSON files passed as arguments) against the live foods table, and
// reports matches a dietitian would flag — wrong-dish matches, unmatched
// names, low-confidence fuzzy hits. A recurring flagged name means a
// staples.json entry is missing; add it and `npm run seed:foods`.
//
// Run: npx tsx scripts/audit-food-matches.mts [plan.json ...]
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Load .env.local before importing src modules (they read env at module load)
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

const { auditItems } = await import("../src/lib/match-audit");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Loosely walk anything plan-shaped and collect item names.
function collectNames(plan: any, into: string[]) {
  for (const day of plan?.days ?? [])
    for (const meal of day?.meals ?? [])
      for (const item of meal?.items ?? []) if (item?.food) into.push(String(item.food));
}

const names: string[] = [];

const { data: rows, error } = await supabase.from("diet_plans").select("id, plan");
if (error) throw new Error(`could not read diet_plans: ${error.message}`);
for (const row of rows ?? []) collectNames(row.plan, names);
console.log(`diet_plans table: ${rows?.length ?? 0} plan(s)`);

for (const file of process.argv.slice(2)) {
  collectNames(JSON.parse(readFileSync(file, "utf8")), names);
  console.log(`file: ${file}`);
}

if (names.length === 0) {
  console.log("no plan items found — pass plan JSON files as arguments or save some plans first.");
  process.exit(0);
}

const findings = await auditItems(supabase as any, names);
const flagged = findings.filter((f) => f.verdict !== "ok");
const okCount = findings.length - flagged.length;

console.log(`\n${findings.length} unique item names audited — ${okCount} ok, ${flagged.length} to verify\n`);
for (const verdict of ["suspect", "unmatched", "weak"] as const) {
  const group = flagged.filter((f) => f.verdict === verdict);
  if (group.length === 0) continue;
  console.log(`--- ${verdict.toUpperCase()} (${group.length}) ---`);
  for (const f of group) {
    const match = f.matchedName ? `${f.matchedName} [${f.source}]` : "NO MATCH";
    console.log(`  ${f.query.padEnd(28)} -> ${match}`);
    console.log(`  ${"".padEnd(28)}    ${f.reason}`);
  }
  console.log();
}

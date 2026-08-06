// Seeds public.regional_food_terms from the committed reference data:
// scripts/data/regional_food_terms.json — a DRAFT glossary compiled via one
// web-search pass per region (see migration 0015_regional_food_terms.sql for
// how to read confidence/notes/nulls). Not reviewed by a dietitian or native
// speaker, and not wired into plan generation yet.
//
// Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (Supabase Dashboard ->
// Project Settings -> API -> service_role). Run: npm run seed:regional-terms
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvLocal() {
  let text;
  try {
    text = readFileSync(join(root, ".env.local"), "utf8");
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.\n" +
      "The service role key is under Supabase Dashboard -> Project Settings -> API."
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { terms } = JSON.parse(
    readFileSync(join(root, "scripts", "data", "regional_food_terms.json"), "utf8")
  );

  const rows = terms.map((t) => ({
    region: t.region,
    canonical_food: t.canonical_food,
    regional_term: t.regional_term,
    script_native: t.script_native ?? null,
    confidence: t.confidence,
    notes: t.notes ?? null,
    sources: t.sources ?? [],
  }));

  const { error } = await supabase
    .from("regional_food_terms")
    .upsert(rows, { onConflict: "region,canonical_food" });
  if (error) {
    console.error(`regional_food_terms: upsert failed: ${error.message}`);
    process.exit(1);
  }

  console.log(`regional_food_terms: ${rows.length} rows seeded.`);
  const confirmed = rows.filter((r) => r.confidence === "confirmed" && r.regional_term).length;
  const partial = rows.filter((r) => r.confidence === "partial").length;
  const unconfirmed = rows.filter((r) => r.confidence === "unconfirmed").length;
  console.log(`  ${confirmed} confirmed terms, ${partial} partial (read notes), ${unconfirmed} unconfirmed (regional_term left NULL).`);
  console.log(`\nDRAFT data — not reviewed by a dietitian or native speaker, not wired into plan generation.`);
}

main();

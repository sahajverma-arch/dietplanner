// Backfills public.foods.cuisine_tags (added in
// supabase/migrations/0010_food_cuisine_tags.sql) so grounding can boost
// matches that fit the client's household cuisine.
//
// USDA is a Western/generic nutrition database with no per-row regional
// identity worth extracting — every row is bulk-tagged "European or Western"
// + "Mixed or international" (the two q34 options a non-Indian-cuisine client
// is most likely to have picked).
//
// INDB recipes and the curated staple names carry a real regional signal in
// their names ("Litti chokha", "Dhokla", "Sarson da saag"), so those are
// classified with the same NVIDIA NIM backend src/lib/nim.ts already uses,
// batched to keep prompts small and reruns cheap to resume.
//
// Idempotent — safe to re-run; each run overwrites cuisine_tags for the rows
// it processes. Run: npx tsx scripts/tag-food-cuisines.mts

import { readFileSync } from "node:fs";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { CUISINE_TAGS, isCuisineTag } from "../src/lib/cuisines";

const root = path.join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const NIM_URL =
  process.env.NVIDIA_NIM_URL || "https://integrate.api.nvidia.com/v1/chat/completions";
const NIM_MODEL = process.env.NVIDIA_MODEL || "meta/llama-3.1-70b-instruct";

const INDIAN_TAGS = CUISINE_TAGS.filter((t) => t !== "European or Western");
const USDA_TAGS = ["European or Western", "Mixed or international"];

type FoodRef = { source: "INDB" | "USDA"; source_id: string; name: string };

async function classifyBatch(names: string[]): Promise<Record<string, string[]>> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY is not configured in .env.local");

  const system =
    "You classify Indian food and recipe names by regional cuisine. " +
    `Allowed tags (use only these, exact spelling): ${INDIAN_TAGS.join(", ")}. ` +
    "Give each food 1-2 tags: the specific region(s) it clearly belongs to " +
    "(e.g. Dhokla -> Gujarati, Litti chokha -> Bihari or Jharkhand, Sambar -> South Indian). " +
    "If a food is a generic staple with no single regional identity " +
    "(plain rice, dal, roti, curd, tea, generic vegetables), tag it \"Pan-Indian\" instead. " +
    'Respond with strict JSON only: {"tags": {"<food name>": ["Tag1", "Tag2"], ...}}, ' +
    "one entry per input name, using the exact input name as the key.";

  const res = await fetch(NIM_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: NIM_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(names) },
      ],
      temperature: 0.1,
      top_p: 0.9,
      max_tokens: 4096,
      stream: false,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`NIM request failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("NIM response missing message content");

  const parsed = JSON.parse(content) as { tags?: Record<string, string[]> };
  const tags = parsed.tags ?? {};

  const cleaned: Record<string, string[]> = {};
  for (const name of names) {
    // The model occasionally returns a bare string instead of a one-item
    // array for a single tag — normalize rather than crash on it.
    const rawValue = tags[name];
    const raw: unknown[] = Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : [];
    const valid = raw.filter((t): t is string => typeof t === "string" && isCuisineTag(t));
    if (valid.length !== raw.length) {
      const dropped = raw.filter((t) => !(typeof t === "string" && isCuisineTag(t)));
      console.warn(`  "${name}": dropping unrecognized tag(s) ${JSON.stringify(dropped)}`);
    }
    cleaned[name] = valid.length ? valid : ["Pan-Indian"];
  }
  return cleaned;
}

async function tagUsda() {
  console.log("USDA: bulk-tagging all rows...");
  const { error, count } = await supabase
    .from("foods")
    .update({ cuisine_tags: USDA_TAGS }, { count: "exact" })
    .eq("source", "USDA");
  if (error) throw new Error(`USDA bulk update failed: ${error.message}`);
  console.log(`USDA: tagged ${count} rows with ${JSON.stringify(USDA_TAGS)}.`);
}

async function tagIndianFoods(refs: FoodRef[]) {
  const BATCH = 40;
  const CONCURRENCY = 4;
  const batches: FoodRef[][] = [];
  for (let i = 0; i < refs.length; i += BATCH) batches.push(refs.slice(i, i + BATCH));

  const tally = new Map<string, number>();
  let done = 0;

  const runBatch = async (batch: FoodRef[]) => {
    const names = batch.map((f) => f.name);
    const tagsByName = await classifyBatch(names);
    for (const f of batch) {
      const tags = tagsByName[f.name] ?? ["Pan-Indian"];
      const { error } = await supabase
        .from("foods")
        .update({ cuisine_tags: tags })
        .eq("source", f.source)
        .eq("source_id", f.source_id);
      if (error) {
        console.error(`  update failed for ${f.source}:${f.source_id} "${f.name}": ${error.message}`);
        continue;
      }
      for (const t of tags) tally.set(t, (tally.get(t) ?? 0) + 1);
    }
    done += batch.length;
    process.stdout.write(`  ${done}/${refs.length}\r`);
  };

  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    await Promise.all(batches.slice(i, i + CONCURRENCY).map(runBatch));
  }
  console.log(`\nClassified ${refs.length} Indian food names.`);
  return tally;
}

async function main() {
  await tagUsda();

  const { foods: indb } = JSON.parse(
    readFileSync(path.join(root, "scripts", "data", "indb_foods.json"), "utf8")
  ) as { foods: { source_id: string | number; name: string }[] };
  const { staples } = JSON.parse(
    readFileSync(path.join(root, "scripts", "data", "staples.json"), "utf8")
  ) as { staples: { name: string; source: "INDB" | "USDA"; source_id: string | number }[] };

  const indbRefs: FoodRef[] = indb.map((f) => ({
    source: "INDB",
    source_id: String(f.source_id),
    name: f.name,
  }));
  // Alias rows use the staple's own display name and the derived source_id
  // seed-foods.mjs computes, so their tags are classified independently of
  // the canonical row they copy nutrients from (e.g. "Chapati" and "Phulka"
  // both point at ASC096 but can read differently by region).
  const staplesOnly = staples.filter((s) => s.source === "INDB" || s.source === "USDA");
  const staleAliasRefs: FoodRef[] = staplesOnly.map((s) => ({
    source: s.source,
    source_id: `alias:${s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name: s.name,
  }));

  console.log(`INDB: classifying ${indbRefs.length} recipes...`);
  const indbTally = await tagIndianFoods(indbRefs);
  console.log(`Staples: classifying ${staleAliasRefs.length} curated names...`);
  const stapleTally = await tagIndianFoods(staleAliasRefs);

  const combined = new Map<string, number>();
  for (const [t, n] of indbTally) combined.set(t, (combined.get(t) ?? 0) + n);
  for (const [t, n] of stapleTally) combined.set(t, (combined.get(t) ?? 0) + n);
  console.log("\nTag distribution (INDB + staples):");
  for (const [t, n] of [...combined.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t}: ${n}`);
  }
}

main().catch((e) => {
  console.error("Tagging failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});

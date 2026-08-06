// One-off: inserts the fabricated test client PRIYA (scripts/test-clients.ts)
// as a REAL client row under the given dietitian's account, using the exact
// shape /api/plan-step's `source:"first"` path uses — so it's indistinguishable
// from a client who actually completed the counselling form, and "Generate
// plan" in the UI works on it normally.
//
// Run: npx tsx scripts/seed-priya-client.mts <dietitian-email>
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
function loadEnvLocal() {
  const text = readFileSync(join(root, ".env.local"), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}
loadEnvLocal();

const email = process.argv[2];
if (!email) {
  console.error("Usage: npx tsx scripts/seed-priya-client.mts <dietitian-email>");
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { toIntake } = await import("../src/lib/counselling/assessment");
const { PRIYA } = await import("./test-clients");

async function main() {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .ilike("email", email)
    .maybeSingle();
  if (profileError) {
    console.error("Profile lookup failed:", profileError.message);
    process.exit(1);
  }
  if (!profile) {
    console.error(
      `No profile found for ${email}. They need to have signed in at least once (Google OAuth creates the profiles row on first login).`
    );
    process.exit(1);
  }
  console.log(`Found dietitian: ${profile.full_name || profile.email} (${profile.id})`);

  const intake = toIntake(PRIYA as any);

  const toNum = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const { data: client, error } = await supabase
    .from("clients")
    .insert({
      dietitian_id: profile.id,
      full_name: intake.fullName.trim(),
      age: toNum(intake.age),
      gender: intake.gender || null,
      height_cm: toNum(intake.heightCm),
      weight_kg: toNum(intake.weightKg),
      goal: intake.goal || null,
      diet_type: intake.dietType || null,
      phone: intake.phone || null,
      email: intake.email || null,
      intake,
    })
    .select("id, full_name")
    .single();
  if (error) {
    console.error("Client insert failed:", error.message);
    process.exit(1);
  }

  console.log(`\nCreated client: ${client.full_name} (${client.id})`);
  console.log(`View it at: /clients/${client.id}`);
}

main();

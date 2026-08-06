// One-off: seeds PRIYA (scripts/test-clients.ts) as a counselling DRAFT under
// the given dietitian's account — the exact row shape ClinicalCounsellingForm
// autosaves (public.form_drafts, kind='first_counselling') — so
// /counselling/review shows it as if the dietitian had just finished typing
// the form, and "Generate plan" from there creates the client fresh through
// the real /api/plan-step "first" path.
//
// Run: npx tsx scripts/seed-priya-draft.mts <dietitian-email>
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
  console.error("Usage: npx tsx scripts/seed-priya-draft.mts <dietitian-email>");
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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
    console.error(`No profile found for ${email}.`);
    process.exit(1);
  }
  console.log(`Found dietitian: ${profile.full_name || profile.email} (${profile.id})`);

  const { data: draft, error: draftError } = await supabase
    .from("form_drafts")
    .upsert(
      {
        dietitian_id: profile.id,
        kind: "first_counselling",
        appointment_id: "",
        data: { answers: PRIYA, appointmentId: null },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "dietitian_id,kind,appointment_id" }
    )
    .select("id")
    .single();
  if (draftError) {
    console.error("form_drafts upsert failed:", draftError.message);
    process.exit(1);
  }

  console.log(`\nSeeded counselling draft: ${draft.id}`);
  console.log(`Open the form at: /counselling/new`);
  console.log(`Or jump straight to the review at: /counselling/review`);
}

main();

// Seeds a fully answered test counselling as the dietitian's saved draft so
// the real app UI can be tested end to end: open "New Counselling" and the
// form loads pre-filled — review it, then Generate Plan runs the real authed
// route (client row, storage PDF, My Clients page).
//
// Any existing draft is backed up to test-output/ before being replaced.
//
// Run: npx -y tsx scripts/seed-ui-test-draft.ts [dietitian-email]

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PRIYA } from "./test-clients";

const envPath = path.join(__dirname, "..", ".env.local");
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

const EMAIL = (process.argv[2] || "sahaj.verma@fitelo.co").toLowerCase();

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, employee_code")
    .ilike("email", EMAIL)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) {
    const { data: all } = await supabase.from("profiles").select("email");
    throw new Error(
      `No profile for ${EMAIL}. Existing profiles: ${(all ?? []).map((p) => p.email).join(", ") || "none"}`
    );
  }
  console.log(`Seeding draft for ${profile.email} (${profile.id})`);

  // Never destroy a half-finished real counselling — back it up first.
  const { data: existing } = await supabase
    .from("form_drafts")
    .select("data, updated_at")
    .eq("dietitian_id", profile.id)
    .eq("kind", "first_counselling")
    .maybeSingle();
  if (existing) {
    const outDir = path.join(__dirname, "..", "test-output");
    mkdirSync(outDir, { recursive: true });
    const backup = path.join(outDir, `draft-backup-${Date.now()}.json`);
    writeFileSync(backup, JSON.stringify(existing, null, 2));
    console.log(`Existing draft (updated ${existing.updated_at}) backed up to ${backup}`);
  }

  const answers = { ...PRIYA, name: "Priya UITest", clientCode: "TEST-UI-001" };
  const { error: upsertError } = await supabase.from("form_drafts").upsert(
    {
      dietitian_id: profile.id,
      kind: "first_counselling",
      data: { answers, appointmentId: null },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "dietitian_id,kind" }
  );
  if (upsertError) throw new Error(upsertError.message);

  console.log(
    "\nDraft seeded. In the app (signed in as " +
      profile.email +
      "):\n  1. Go to My Clients and click “New Counselling” (no appointment).\n" +
      "  2. The form loads fully answered for “Priya UITest” — check the peanut-allergy red flag and audit score.\n" +
      "  3. Submit / Generate Plan — the real route creates the client, uploads the PDF and opens the client page."
  );
}

main().catch((e) => {
  console.error("Seeding failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});

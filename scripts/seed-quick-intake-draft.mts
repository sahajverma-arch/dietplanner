// Seeds a representative Quick Counselling DRAFT (not a submission) for a
// dietitian to open in the real UI and click through themselves — saved
// under the quick-intake draft's own storage kind, never touching the full
// form's "first_counselling" drafts.
//
// This intentionally does NOT run fillUnaskedRequired()/buildSubmission() —
// a draft is what QuickCounsellingForm's own autosave writes: only the
// curated answers actually typed, so the form (and its fields) render
// exactly as if a dietitian had filled it in.
//
// Run: npx tsx scripts/seed-quick-intake-draft.mts <dietitian-email>
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
  console.error("Usage: npx tsx scripts/seed-quick-intake-draft.mts <dietitian-email>");
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { QUICK_INTAKE_DRAFT_KIND } = await import("../src/lib/counselling/quick-intake");

// Exactly the curated fields QuickCounsellingForm's GROUPS ask for — a
// realistic partial fill, the same shape a dietitian would leave mid-call.
const draftAnswers: Record<string, string | string[]> = {
  name: "Meera Kapoor (Quick Test)",
  gender: "Female",
  phone: "+91 98222 44556",
  q9_age: "34",
  q9_height: "163",
  q9_weight: "74",
  q2: "Fat Loss With Muscle Preservation",
  q76_category: "First-timer — never dieted with structure before",
  q54c: "Moderately active",
  q43: ["Walking", "Strength training"],
  q44a: "3",
  q44b: "30–45 minutes",
  q44e: "Moderate",
  q44d: "Less than 6 months",
  q33: "Non-vegetarian",
  q27: ["No known allergy or intolerance"],
  q36: "Mushroom, bitter gourd",
  q35: "Chicken, eggs, seasonal fruits, dal",
  q34: ["South Indian", "Tamil"],
  q28: ["Breakfast", "Mid-Morning", "Lunch", "Evening", "Dinner"],
  q38: ["No restriction"],
  q17: ["No Medical Condition"],
  q19: "No",
  q19a: "None",
  q50a: "3",
};

async function main() {
  const { data: profile } = await supabase.from("profiles").select("id, email, full_name").ilike("email", email).maybeSingle();
  if (!profile) {
    console.error(`No profile found for ${email}`);
    process.exit(1);
  }
  console.log(`Dietitian: ${profile.full_name || profile.email} (${profile.id})`);

  const { error } = await supabase.from("form_drafts").upsert(
    {
      dietitian_id: profile.id,
      kind: QUICK_INTAKE_DRAFT_KIND,
      appointment_id: "",
      data: { answers: draftAnswers, appointmentId: null },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "dietitian_id,kind,appointment_id" }
  );
  if (error) {
    console.error("Failed to save draft:", error.message);
    process.exit(1);
  }

  console.log(`\nSeeded a Quick Counselling draft for "${draftAnswers.name}".`);
  console.log(`Open it at: http://localhost:3000/counselling/quick-new`);
  console.log(`(the "+ Quick Counselling" button on the dashboard goes to the same place)`);
}

main();

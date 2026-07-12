# Dietitian Diet Platform

A full-stack platform for dietitians: run a live first-counselling session (the form
autosaves while you're on the 45–50 min call), generate a strict-JSON 1-week diet plan
with **NVIDIA NIM (llama-3.1-70b-instruct)**, render it to a **PDF stored in Supabase
Storage**, and manage weekly follow-ups that produce updated plans — with **Row Level
Security** so every dietitian sees only their own clients.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind CSS |
| Auth / DB / Files | Supabase (Postgres + Auth + Storage, RLS everywhere) |
| AI | NVIDIA NIM API — `meta/llama-3.1-70b-instruct` (server-side only) |
| PDF | `@react-pdf/renderer` (rendered server-side, uploaded to a private bucket) |
| Hosting | Vercel |

## How it works

1. **Sign in** — "Continue with Google", restricted to **@fitelo.co** accounts
   (enforced in the DB trigger and the OAuth callback, not just the UI). On first
   sign-in a `profiles` row is auto-created and the user completes onboarding
   (employee code + phone — used for reporting/data mapping). Admins
   (`profiles.role = 'admin'`) get a read-only `/admin` overview of the whole team.
2. **+ New Counselling** — a 5-section form (Basics · Food Preferences · Lifestyle ·
   Medical · Notes). Every keystroke is debounced and upserted into `form_drafts`, so
   nothing is lost mid-call and the draft is restored if the tab is closed.
3. **Generate Week 1 Diet Plan** — the form goes to `POST /api/generate-plan`
   (server-side; the NVIDIA key never reaches the browser). The route:
   - creates the `clients` row,
   - prompts NIM for a strict-JSON 7-day plan honouring diet type
     (veg/non-veg/vegan/eggetarian), allergies, dislikes and medical conditions,
   - validates the JSON with Zod (one automatic corrective retry on bad output),
   - renders a PDF and uploads it to the private `diet-pdfs` bucket under
     `<dietitian_id>/<client_id>/…`,
   - saves the plan row and clears the draft.
4. **Weekly follow-up** — open the client, record weight / adherence / complaints, and
   generate the next week's plan. The AI sees the intake, the follow-up and last week's
   menu (for variety). Each plan's PDF is downloadable via short-lived signed URLs.
5. **Isolation** — every table has RLS `dietitian_id = auth.uid()`; storage policies
   only allow access to objects inside the caller's own folder.

## Project structure

```
supabase/migrations/0001_init.sql   # tables + RLS + trigger + storage bucket/policies
supabase/migrations/0002_foods.sql  # foods reference table + fuzzy-match function
supabase/migrations/0003_match_ranking.sql  # blended match scoring (exact/INDB/raw rules)
scripts/
  seed-foods.mjs                    # seeds public.foods from scripts/data/*.json
  data/indb_foods.json              # INDB — 1,014 Indian recipes (ICMR-NIN IFCT based)
  data/usda_foods.json              # USDA SR Legacy — 6,781 generic foods (CC0)
  data/staples.json                 # curated exact-name staples ("Roti", "Banana", "Curd")
src/
  middleware.ts                     # session refresh + auth-gate for all routes
  app/
    login/page.tsx                  # "Continue with Google" (fitelo.co only)
    auth/callback/route.ts          # OAuth code exchange + domain check
    onboarding/page.tsx             # first-login: employee code + phone
    admin/page.tsx                  # read-only team overview (role = admin)
    page.tsx                        # dashboard — client cards + "+ New Counselling"
    counselling/new/page.tsx        # first-counselling form (autosave)
    clients/[id]/page.tsx           # client detail, plan history, follow-up form
    api/generate-plan/route.ts      # NIM call + Zod validation + grounding + PDF
    auth/signout/route.ts
  lib/
    nim.ts                          # NVIDIA NIM client, prompt, strict plan schema
    nutrition.ts                    # grounds AI macro estimates in the foods table
    pdf.tsx                         # @react-pdf/renderer document
    supabase/{client,server}.ts     # browser / server Supabase clients
  components/                       # forms, cards, plan viewer, PDF download
```

## Nutrition grounding (foods reference database)

The model is good at composing culturally appropriate menus but only *estimates*
calories/macros. After generation, `src/lib/nutrition.ts` re-computes every meal's
numbers from a credible reference table:

- **INDB** — [Indian Nutrient Databank](https://www.anuvaad.org.in/indian-nutrient-databank/)
  (Anuvaad Solutions, built on **ICMR-NIN IFCT 2017**): 1,014 Indian recipes with
  per-100 g nutrients *and* household serving weights (one parantha = 56 g, one bowl
  of dal makhani = 353 g). Cite: *Vijayakumar A, Dubasi HB, Awasthi A, Jaacks LM.
  Development of an Indian Food Composition Database. Curr Dev Nutr. 2024.*
- **USDA FoodData Central (SR Legacy)** — 6,781 generic/raw foods, public domain (CC0).

How it works per plan: all item names go to Postgres in **one RPC**
(`match_foods_batch`, `pg_trgm` fuzzy matching with a small preference for Indian
entries), quantities like `"2 rotis"`, `"150 g"`, `"1 katori"` are resolved to grams,
and a meal's macros are replaced **only when every item in it matched and resolved** —
otherwise that meal keeps the model's estimate (mixing DB values for some items with
nothing for the rest would undercount). Grounding is non-fatal: if the `foods` table
is missing or empty, plans generate exactly as before.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the entire contents of
   `supabase/migrations/0001_init.sql`, and run it. This creates all tables, RLS
   policies, the signup trigger, the private `diet-pdfs` bucket and its policies.
   (Alternative: `supabase link && supabase db push` with the CLI.)
3. Repeat with `supabase/migrations/0002_foods.sql` and `0003_match_ranking.sql`
   (foods reference table + match scoring), then seed it: put your **service_role**
   key in `.env.local` as `SUPABASE_SERVICE_ROLE_KEY` and run `npm run seed:foods`
   (~7,900 rows, one-off; safe to re-run — it upserts).
4. Run `supabase/migrations/0004_google_auth_admin.sql` (fitelo.co-only signups,
   profile fields, admin role/policies).
5. **Google sign-in** (one-time):
   1. In [Google Cloud Console](https://console.cloud.google.com) → APIs & Services →
      Credentials → **Create OAuth client ID** (type: Web application). Add the
      authorized redirect URI shown in Supabase under
      **Authentication → Sign In / Providers → Google** (looks like
      `https://<ref>.supabase.co/auth/v1/callback`).
   2. Paste the client ID + secret into that same Supabase Google provider screen
      and enable it.
   3. Under **Authentication → URL Configuration** add your app URLs (local +
      production) to Site URL / Redirect URLs, e.g. `http://localhost:3000/**`.
6. Make yourself admin:
   `update public.profiles set role = 'admin' where email = 'you@fitelo.co';`
7. Copy the **Project URL** and **anon public key** from **Project Settings → API**.

### 2. NVIDIA NIM

1. Go to [build.nvidia.com](https://build.nvidia.com), sign in, and generate an API
   key (`nvapi-…`). The free tier includes generous credits.
2. The app uses `meta/llama-3.1-70b-instruct` via the OpenAI-compatible endpoint
   `https://integrate.api.nvidia.com/v1/chat/completions`. Override with
   `NVIDIA_MODEL` / `NVIDIA_NIM_URL` if needed.

### 3. Run locally

```bash
git clone <your-repo-url>
cd dietitian-platform
npm install
cp .env.example .env.local   # then fill in the three values
npm run dev                  # http://localhost:3000
```

`.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NVIDIA_API_KEY=nvapi-...
```

> `NVIDIA_API_KEY` has no `NEXT_PUBLIC_` prefix on purpose — it is only read inside
> the `/api/generate-plan` route and never shipped to the browser.

### 4. Deploy to Vercel

1. Push the repo to GitHub:
   ```bash
   git init && git add -A && git commit -m "Dietitian diet platform"
   git remote add origin https://github.com/<you>/dietitian-platform.git
   git push -u origin main
   ```
2. On [vercel.com](https://vercel.com) → **Add New → Project** → import the repo
   (framework auto-detected as Next.js).
3. Add the three environment variables from `.env.example` under
   **Settings → Environment Variables** (Production + Preview).
4. Deploy. The generate route declares `maxDuration = 60`, which is supported on the
   Vercel Hobby plan.
5. In Supabase, add your Vercel domain under
   **Authentication → URL Configuration → Site URL / Redirect URLs**.

## Environment variables

| Variable | Where used | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Safe to expose — RLS enforces access |
| `NVIDIA_API_KEY` | **server only** | Never exposed to the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | **local seeding only** | Only needed to run `npm run seed:foods`; never deploy it to Vercel |
| `NVIDIA_MODEL` | server, optional | Defaults to `meta/llama-3.1-70b-instruct`; if that shared endpoint is congested, `mistralai/mistral-small-4-119b-2603` is a fast, strong alternative |
| `NVIDIA_FALLBACK_MODEL` | server, optional | Tried automatically when the primary model times out or errors; defaults to `meta/llama-3.1-8b-instruct` |
| `NVIDIA_NIM_URL` | server, optional | Defaults to the hosted NIM endpoint |

## AI output contract

The model must return a single JSON object:

```jsonc
{
  "summary": "...",
  "daily_calories": 1600,
  "macros": { "protein_g": 90, "carbs_g": 180, "fat_g": 50 },
  "guidelines": ["..."],
  "hydration": "...",
  "days": [ /* exactly 7 */ {
    "day": "Day 1",
    "total_calories": 1600,
    "meals": [{ "name": "Breakfast", "time": "8:00 AM",
                "items": [{ "food": "Vegetable poha", "quantity": "1.5 cups" }],
                "notes": "" }]
  }],
  "foods_to_avoid": ["..."]
}
```

Responses are validated with Zod (`src/lib/nim.ts`). On a parse/validation failure the
errors are sent back to the model for one corrected attempt; if that also fails the API
returns 502 and the UI offers a retry (the client record and draft are never lost).

## Troubleshooting

- **401 / 403 from NIM** — bad or missing `NVIDIA_API_KEY`.
- **429 from NIM** — free-tier rate limit; retry after a minute.
- **"AI returned an invalid diet plan"** — rare double-failure of validation; just hit
  the retry/generate button again.
- **Signup works but sign-in says email not confirmed** — disable "Confirm email" in
  Supabase auth settings (or confirm via the emailed link).
- **PDF download does nothing** — check the storage policies from the migration ran,
  and that your browser isn't blocking the pop-up.

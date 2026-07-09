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

1. **Sign in** — Supabase email/password auth. A `profiles` row is auto-created by a
   DB trigger on signup.
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
src/
  middleware.ts                     # session refresh + auth-gate for all routes
  app/
    login/page.tsx                  # sign in / sign up
    page.tsx                        # dashboard — client cards + "+ New Counselling"
    counselling/new/page.tsx        # first-counselling form (autosave)
    clients/[id]/page.tsx           # client detail, plan history, follow-up form
    api/generate-plan/route.ts      # NIM call + Zod validation + PDF + storage
    auth/signout/route.ts
  lib/
    nim.ts                          # NVIDIA NIM client, prompt, strict plan schema
    pdf.tsx                         # @react-pdf/renderer document
    supabase/{client,server}.ts     # browser / server Supabase clients
  components/                       # forms, cards, plan viewer, PDF download
```

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the entire contents of
   `supabase/migrations/0001_init.sql`, and run it. This creates all tables, RLS
   policies, the signup trigger, the private `diet-pdfs` bucket and its policies.
   (Alternative: `supabase link && supabase db push` with the CLI.)
3. *(Recommended for quick start)* **Authentication → Sign In / Providers → Email**:
   turn **off** "Confirm email" so dietitians can sign in immediately after signup.
   If you keep it on, users must click the confirmation link first — the app handles
   both cases.
4. Copy the **Project URL** and **anon public key** from **Project Settings → API**.

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
| `NVIDIA_MODEL` | server, optional | Defaults to `meta/llama-3.1-70b-instruct` |
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

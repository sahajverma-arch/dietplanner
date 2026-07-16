-- ============================================================================
-- Human-in-the-loop plan review.
-- Every generated plan is first stored as a DRAFT preview (no PDF). The
-- dietitian reviews it on the client page, optionally sends written change
-- instructions back to the AI (any number of times), and only an approved
-- plan gets its PDF rendered and becomes final.
-- ============================================================================

alter table public.diet_plans
  add column if not exists status text not null default 'final'
    check (status in ('draft', 'final')),
  -- Day 1 of the plan, fixed at generation time so the weekday-specific food
  -- rules (q38) and the PDF's date labels agree even when approval happens
  -- later than generation.
  add column if not exists starts_on date,
  -- Dietitian change instructions applied to this plan, oldest first:
  -- [{ "instructions": string, "at": timestamptz }]
  add column if not exists revisions jsonb not null default '[]'::jsonb;

-- Existing rows predate the review flow and already have their PDF — the
-- 'final' default above covers them.

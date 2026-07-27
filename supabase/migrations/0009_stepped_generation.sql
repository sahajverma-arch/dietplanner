-- ============================================================================
-- Stepped plan generation.
--
-- Generating a week is up to 5 model calls plus a correction round, which no
-- longer fits in one HTTP request on hosting that caps a function at 60s. The
-- work is now driven one step per request, so the plan row has to survive
-- between them: a row is created up front, each step appends its result, and
-- only the last step promotes it to a reviewable draft.
--
-- 'generating' rows are partial by definition — their `plan` does not satisfy
-- the 7-day schema until the final step — so every reader must filter on
-- status rather than assume a row is complete.
--
-- Run once in the Supabase SQL Editor, after 0008.
-- ============================================================================

alter table public.diet_plans
  drop constraint if exists diet_plans_status_check;

alter table public.diet_plans
  add constraint diet_plans_status_check
    check (status in ('generating', 'draft', 'final'));

alter table public.diet_plans
  -- Which step runs next: 'overview', 'days:0'..'days:3', 'ground',
  -- 'fix:0'..'fix:3', 'settle'. NULL once the plan is a draft or final.
  add column if not exists stage text,
  -- Scratch space for a generation in flight: the correction instructions
  -- decided at the 'ground' step, and the days a correction round has built
  -- so far. Cleared when generation finishes.
  add column if not exists generation jsonb not null default '{}'::jsonb;

-- A stalled generation (browser closed mid-run) would otherwise sit in the
-- client's plan history forever pretending to be real work.
create index if not exists diet_plans_generating_idx
  on public.diet_plans (client_id, created_at desc)
  where status = 'generating';

comment on column public.diet_plans.stage is
  'Next generation step for a status=generating row; NULL when complete.';

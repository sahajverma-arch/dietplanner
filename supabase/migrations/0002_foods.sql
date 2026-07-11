-- ============================================================================
-- FOODS — credible nutrition reference data (INDB Indian recipes + USDA SR
-- Legacy), used to ground the AI-generated meal macros in real values.
-- Run once in the Supabase SQL Editor (or via `supabase db push`), then seed
-- with `npm run seed:foods`.
-- ============================================================================

create extension if not exists pg_trgm;

-- ----------------------------------------------------------------------------
-- FOODS — one row per food/recipe; all nutrient values are per 100 g.
-- serving_g/serving_unit describe one household serving (e.g. 56 g per roti).
-- ----------------------------------------------------------------------------
create table if not exists public.foods (
  id bigint generated always as identity primary key,
  source text not null check (source in ('INDB', 'USDA')),
  source_id text not null,
  name text not null,
  food_group text,
  kcal numeric not null,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  fiber_g numeric,
  serving_unit text,
  serving_g numeric,
  micros jsonb not null default '{}'::jsonb,
  search_text text generated always as (lower(name)) stored,
  created_at timestamptz not null default now(),
  unique (source, source_id)
);

create index if not exists foods_search_trgm_idx
  on public.foods using gin (search_text gin_trgm_ops);

alter table public.foods enable row level security;

-- Reference data: any signed-in dietitian can read; only the service role
-- (seed script) writes, which bypasses RLS — no insert/update policies needed.
create policy "foods_select_authenticated" on public.foods
  for select to authenticated using (true);

-- ----------------------------------------------------------------------------
-- MATCH_FOODS_BATCH — fuzzy-match many food names in one round trip.
-- Returns the single best match per query with its similarity score; the
-- caller decides the acceptance threshold. INDB (Indian) entries get a small
-- boost so "dal makhani" prefers the Indian recipe over a USDA lookalike.
-- ----------------------------------------------------------------------------
create or replace function public.match_foods_batch(queries text[])
returns table (
  query text,
  food_id bigint,
  name text,
  source text,
  kcal numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  serving_unit text,
  serving_g numeric,
  similarity real
)
language sql
stable
set search_path = public
as $$
  select
    q.query,
    f.id,
    f.name,
    f.source,
    f.kcal,
    f.protein_g,
    f.carbs_g,
    f.fat_g,
    f.fiber_g,
    f.serving_unit,
    f.serving_g,
    f.sim
  from unnest(queries) as q(query)
  cross join lateral (
    select
      f.*,
      word_similarity(lower(q.query), f.search_text) as sim
    from public.foods f
    order by
      word_similarity(lower(q.query), f.search_text)
        + case when f.source = 'INDB' then 0.05 else 0 end desc,
      length(f.name) asc
    limit 1
  ) f
$$;

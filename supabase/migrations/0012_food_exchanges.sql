-- ============================================================================
-- FOOD EXCHANGES — the high-protein Indian exchange list (curated, ~88 foods
-- across 12 groups), seeded with `npm run seed:food-exchanges`.
--
-- Distinct from public.foods (INDB/USDA, ~8,000 rows, matched by fuzzy trigram
-- similarity): this table exists because brand/preparation variance on a
-- single generic-DB match can swing protein by several grams (e.g. Aashirvaad
-- regular vs high-protein atta), which is too much noise for the macro the
-- whole plan is built to protect. Every row here is a class average or a
-- declared label value, not a fuzzy match — so "1 pulse exchange" means the
-- same ~7 g of protein whichever specific dal the client picks.
--
-- STATUS: DRAFT data, transcribed from the Fitelo exchange-list spreadsheet.
-- Not yet clinically reviewed — the nutrition team should verify every row
-- before this is used to build a client-facing plan.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FOOD_EXCHANGE_GROUPS — one row per exchange group, carrying the group's
-- AVERAGE macros per 1 exchange (the "anchor"). This is authored data, not a
-- live average of food_exchanges: the anchor is a deliberately round number
-- (e.g. 7.0 g protein for Pulses & Legumes) that individual foods cluster
-- around, not the literal mean of whichever rows happen to be in the table.
-- The solver plans against these anchors; a specific food is chosen from
-- food_exchanges afterward by client preference.
-- ----------------------------------------------------------------------------
create table if not exists public.food_exchange_groups (
  id text primary key,
  label text not null,
  sort_order int not null,
  protein_g numeric not null,
  carbs_g numeric not null,
  fat_g numeric not null,
  fiber_g numeric not null default 0,
  -- kcal is COMPUTED (P*4 + C*4 + F*9), never taken from a source table — the
  -- spreadsheet's own convention, kept so the number can never drift from the
  -- macros it is supposed to summarise.
  kcal numeric generated always as (round(protein_g * 4 + carbs_g * 4 + fat_g * 9, 1)) stored,
  protein_per_100kcal numeric generated always as (
    case when (protein_g * 4 + carbs_g * 4 + fat_g * 9) = 0 then 0
    else round(protein_g * 100 / (protein_g * 4 + carbs_g * 4 + fat_g * 9), 1)
    end
  ) stored,
  standard_serving text not null,
  notes text
);

alter table public.food_exchange_groups enable row level security;

create policy "food_exchange_groups_select_authenticated" on public.food_exchange_groups
  for select to authenticated using (true);

-- ----------------------------------------------------------------------------
-- FOOD_EXCHANGES — individual foods within a group, one row = one exchange
-- (the serving size that carries that group's anchor protein, give or take —
-- see each row's own macros, which is what the plan actually totals against).
-- ----------------------------------------------------------------------------
create table if not exists public.food_exchanges (
  id bigint generated always as identity primary key,
  group_id text not null references public.food_exchange_groups(id),
  name text not null,
  serving_g numeric not null,
  household_measure text,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  fiber_g numeric not null default 0,
  kcal numeric generated always as (round(protein_g * 4 + carbs_g * 4 + fat_g * 9, 1)) stored,
  protein_per_100kcal numeric generated always as (
    case when (protein_g * 4 + carbs_g * 4 + fat_g * 9) = 0 then 0
    else round(protein_g * 100 / (protein_g * 4 + carbs_g * 4 + fat_g * 9), 1)
    end
  ) stored,
  -- Which diet types this food is safe to offer under. Vegetarian/vegan/Jain
  -- exclusions are inferred at seed time (root vegetables and eggs excluded
  -- from Jain, dairy excluded from vegan) — see scripts/seed-food-exchanges.mjs
  -- for the exact rule; this is inference, not a nutrition-team ruling.
  diet_tags text[] not null default '{}',
  notes text,
  search_text text generated always as (lower(name)) stored,
  created_at timestamptz not null default now(),
  unique (group_id, name)
);

create index if not exists food_exchanges_group_idx on public.food_exchanges (group_id);
create index if not exists food_exchanges_diet_tags_idx on public.food_exchanges using gin (diet_tags);
create index if not exists food_exchanges_search_trgm_idx
  on public.food_exchanges using gin (search_text gin_trgm_ops);

alter table public.food_exchanges enable row level security;

create policy "food_exchanges_select_authenticated" on public.food_exchanges
  for select to authenticated using (true);

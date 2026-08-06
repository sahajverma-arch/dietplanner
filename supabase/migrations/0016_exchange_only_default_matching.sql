-- ============================================================================
-- match_foods_batch — now PERMANENTLY scoped to the exchange list only.
--
-- Previously this matched against the full public.foods corpus (INDB + USDA +
-- the exchange list), with the exchange list winning ties via a score boost
-- (migration 0013). As of this migration it no longer considers INDB or USDA
-- rows at all — every plan generated from here on grounds exclusively against
-- the 88-food curated exchange list (source_id like 'exchange:%').
--
-- This is a deliberate accuracy trade-off, not a bug: earlier QA runs
-- (scripts/create-kavya-plan-exchange-only.mts) measured ~82-91% item match
-- but only ~51-66% of MEALS fully grounding (every item in a meal must match
-- for the meal to be priced from the database) — the exchange list has no
-- entry for most vegetables, spices and composed dishes, so roughly half of
-- meals now fall back to the model's own ungrounded estimate instead of a
-- verified one. Reverting means restoring the pre-migration 0013 body (or
-- re-running `create or replace function match_foods_batch` from that
-- migration file) if that trade-off ever needs to be undone.
--
-- match_exchange_foods_batch (migration 0014) is now functionally identical
-- to this function and is left in place unused rather than dropped — no harm
-- in it remaining as a standalone reference.
-- ============================================================================

create or replace function public.match_foods_batch(
  queries text[],
  cuisines text[] default '{}'
)
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
    f.score::real
  from unnest(queries) as q(query)
  cross join lateral (
    select
      f.*,
      (
        word_similarity(lower(q.query), f.search_text) * 0.72
        + similarity(lower(q.query), f.search_text) * 0.28
        + case when f.search_text = lower(q.query) then 0.30 else 0 end
        + case
            when f.cuisine_tags && cuisines then 0.06
            when 'Pan-Indian' = any(f.cuisine_tags) then 0.02
            else 0
          end
        - case
            when f.search_text ~ '\y(uncooked|dried|dry|raw|powder)\y'
             and lower(q.query) !~ '\y(uncooked|dried|dry|raw|powder)\y'
            then 0.10 else 0
          end
      ) as score
    from public.foods f
    where f.source_id like 'exchange:%'
    order by score desc, length(f.name) asc
    limit 1
  ) f
$$;

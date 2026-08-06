-- ============================================================================
-- Exchange-only food matching — a ONE-OFF QA function, not wired into normal
-- plan generation. Lets us generate and ground a plan using nothing but the
-- 88-food exchange list (public.food_exchanges, seeded into public.foods
-- with source_id 'exchange:%' by migration 0012/0013), to see how a plan
-- looks with zero INDB/USDA fallback.
--
-- A separate function rather than a flag on match_foods_batch (0013) so the
-- function every real client's plan is grounded against is untouched by this
-- experiment — this one is additive only, called by scripts/*, never by the
-- app's normal generation path.
-- ============================================================================

create or replace function public.match_exchange_foods_batch(
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

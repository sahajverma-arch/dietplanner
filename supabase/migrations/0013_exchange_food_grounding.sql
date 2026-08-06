-- ============================================================================
-- Grounding preference for exchange-list foods.
--
-- The exchange list (migration 0012, public.food_exchanges) exists because a
-- fuzzy match against the ~8,000-row public.foods table is brand/preparation
-- noisy — the same food can swing several grams of protein depending on which
-- INDB or USDA row wins the trigram match. The 88 exchange foods are curated
-- specifically to not have that problem.
--
-- Rather than build a second, parallel matching path, the exchange foods are
-- seeded into public.foods too (npm run seed:food-exchanges, updated
-- alongside this migration), with source_id prefixed 'exchange:' and their
-- per-serving macros converted to the table's per-100g convention. This
-- boost is what makes them win a tie against a generic row with a similar
-- name — the same mechanism 0008 already uses for staples.json's 'alias:%'
-- rows, at roughly double the weight: the exchange list is more deliberately
-- curated than a staple override; the boost reflects that without letting a
-- weakly-matching exchange row outrank a genuinely better-matching food (the
-- same restraint 0008 already documents for its own boost).
--
-- Run once in the Supabase SQL Editor, after 0012. Re-run
-- `npm run seed:food-exchanges` afterward if it hasn't been run since this
-- migration's seed-script changes landed.
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
        + case when f.source = 'INDB' then 0.03 else 0 end
        -- Curated staple alias: settles a tie with the row it overrides.
        + case when f.source_id like 'alias:%' then 0.02 else 0 end
        -- Curated exchange-list row: precision-critical (protein-bearing
        -- items especially), so it outranks both a generic INDB/USDA row
        -- and a staple alias on an otherwise-tied name.
        + case when f.source_id like 'exchange:%' then 0.04 else 0 end
        -- Client's household cuisine: prefer a regional match, and treat
        -- pan-Indian staples as a weaker but still reasonable fallback.
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
    order by score desc, length(f.name) asc
    limit 1
  ) f
$$;

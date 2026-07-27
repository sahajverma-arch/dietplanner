-- ============================================================================
-- Curated staple rows must win ties against the canonical row they alias.
--
-- 0003 gives an exact-name match +0.30, which was meant to make staples win.
-- It does not when the alias and its canonical source share a name: "Honey"
-- exists twice — USDA 169640 (serving 339 g, a CUP of honey) and alias:honey
-- (21 g, a tablespoon, which is how a diet plan actually uses it). Both score
-- identically, both names are the same length, so the tie broke arbitrarily
-- and the 339 g row kept winning. Every "1 tsp honey" then priced as 1031 kcal
-- and was silently dropped from the meal for exceeding the per-item ceiling.
--
-- The whole purpose of a staples.json serving override is to beat the
-- canonical portion, so alias rows now carry a small explicit preference.
-- It is deliberately tiny (0.02): it settles ties without ever letting a
-- weakly-matching alias outrank a genuinely better-matching food.
--
-- Run once in the Supabase SQL Editor, after 0007. No re-seed required.
-- ============================================================================

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

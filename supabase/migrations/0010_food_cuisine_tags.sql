-- ============================================================================
-- Region/cuisine-aware food matching.
--
-- Grounding previously matched meal items to `foods` on name similarity
-- alone, with zero awareness of the client's household cuisine (captured at
-- intake, q34: Punjabi, Gujarati, South Indian, etc.). Two foods with equally
-- similar names could differ in regional fit and grounding had no way to
-- prefer the one that actually matches the client's kitchen.
--
-- cuisine_tags is an array, not a single tag: staples (dal, rice, roti, curd)
-- are legitimately shared across many regions, and forcing one tag per food
-- would misclassify them. The vocabulary mirrors q34's option strings exactly
-- (see src/lib/cuisines.ts), plus a "Pan-Indian" catch-all, so a client's
-- intake cuisines can be compared directly with `&&` — no translation layer
-- needed. Rows are backfilled by scripts/tag-food-cuisines.mts.
--
-- The boost is intentionally small and additive to the existing score, not a
-- WHERE filter: a hard filter would zero-match a client eating out-of-region,
-- or starve matches across the ~87% of the corpus (USDA) that isn't Indian at
-- all. `cuisines` defaults to '{}' so every existing caller of
-- match_foods_batch(queries) keeps working unchanged.
--
-- Run once in the Supabase SQL Editor, after 0009. Re-run
-- scripts/tag-food-cuisines.mts afterward to populate the new column.
-- ============================================================================

alter table public.foods
  add column if not exists cuisine_tags text[] not null default '{}';

create index if not exists foods_cuisine_tags_idx
  on public.foods using gin (cuisine_tags);

-- `create or replace function` only replaces a function with the SAME
-- parameter list. Adding `cuisines` changes the signature, so without this
-- drop the old single-argument version keeps existing alongside the new one
-- and PostgREST refuses any call that passes only `queries` ("Could not
-- choose the best candidate function...").
drop function if exists public.match_foods_batch(text[]);

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

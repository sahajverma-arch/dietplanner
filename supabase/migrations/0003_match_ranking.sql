-- ============================================================================
-- Better food-match ranking. v1 ordered by word_similarity alone, which let
-- short queries win against longer recipe names ("banana" -> "Banana appam",
-- "brown rice" -> "brown rice chips"). The score now blends:
--   * word_similarity  — best contiguous match (recall)
--   * similarity       — whole-string trigram overlap (penalizes names with
--                        extra dishes/ingredients beyond the query)
--   * exact-name bonus — curated staple rows ("Banana", "Roti") always win
--   * small INDB preference
--   * penalty when the food is uncooked/dried/raw/powder but the query
--     doesn't say so ("quinoa upma" must not get "Quinoa, uncooked")
-- Run once in the Supabase SQL Editor, after 0002. Re-run `npm run seed:foods`
-- to pick up the staple alias rows.
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

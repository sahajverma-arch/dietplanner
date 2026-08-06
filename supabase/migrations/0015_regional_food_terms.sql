-- ============================================================================
-- REGIONAL FOOD TERMS — draft glossary mapping the canonical food names this
-- app already generates/grounds against (Roti, Dal, Curd, Buttermilk, Rice,
-- Jaggery, Ghee) to the term a client's own regional cuisine would use for
-- the same food, keyed by the counselling form's q34 "household cuisine"
-- answer so it can be joined straight off intake.cuisines.
--
-- NOT wired into plan generation or display yet. This is a DRAFT, compiled
-- via web search (see seed-regional-food-terms.mjs / scripts/data), the same
-- one-off research pass used to evaluate the idea — not a nutrition-team or
-- native-speaker review. Two things a reviewer must know before this is ever
-- used to rename anything in a client-facing plan:
--
--  1. Some foods have NO real regional equivalent (e.g. Tamil Nadu and Kerala
--     are rice-based cuisines with no native word for "roti" — Tamil/Malayalam
--     speakers just say "chapati"). regional_term is NULL in exactly these
--     cases; NULL must mean "leave the canonical name as-is", never "blank
--     it out" or "guess one".
--  2. A same-language "generic" word can still be wrong for a specific dish
--     (Tamil "paruppu" is dal in general, but "pasi paruppu" specifically
--     means moong dal — do not apply a variety-specific term to a different
--     variety). See each row's `notes`.
--
-- confidence: 'confirmed' (clear, consistent source support), 'partial' (real
-- term, but a caveat in `notes` must be respected before using it), or
-- 'unconfirmed' (nothing reliable surfaced this pass — regional_term is NULL
-- pending a follow-up check, not because no term exists).
-- ============================================================================

create table if not exists public.regional_food_terms (
  id bigint generated always as identity primary key,
  -- Matches a counselling q34 option string exactly (src/lib/counselling/questions.ts)
  -- so this can be joined straight off intake.cuisines with no translation layer.
  region text not null,
  -- NULL = a region-level note (e.g. "too broad, see the specific regions"),
  -- not a per-food mapping.
  canonical_food text,
  -- NULL = no reliable distinct term for this food in this region; the
  -- canonical name should be left unchanged, not blanked or guessed.
  regional_term text,
  -- Native-script rendering, where available. Optional.
  script_native text,
  confidence text not null default 'unconfirmed'
    check (confidence in ('confirmed', 'partial', 'unconfirmed')),
  notes text,
  sources text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (region, canonical_food)
);

create index if not exists regional_food_terms_region_idx on public.regional_food_terms (region);

alter table public.regional_food_terms enable row level security;

create policy "regional_food_terms_select_authenticated" on public.regional_food_terms
  for select to authenticated using (true);

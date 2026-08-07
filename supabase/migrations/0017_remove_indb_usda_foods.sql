-- ============================================================================
-- Removes the bulk INDB/USDA corpus and the alias/staple rows derived from
-- it. Production grounding has matched ONLY the exchange list since
-- migration 0016 — none of these rows have grounded a single plan since,
-- and keeping them around was itself a source of confusion: the 118
-- exchange-list rows were labeled source='INDB' purely to satisfy the old
-- check constraint (see scripts/seed-food-exchanges.mjs), so the source
-- column alone could not tell a real INDB row from a curated exchange row —
-- only the source_id 'exchange:%' prefix could.
--
-- This migration:
--   1. Relabels the exchange rows to an unambiguous source='EXCHANGE'.
--   2. Deletes every row that is NOT an exchange row — real INDB, real
--      USDA, and the 233 'alias:%' staple rows (already unused in
--      production since migration 0016 restricted match_foods_batch to
--      source_id like 'exchange:%').
--   3. Narrows the check constraint to 'EXCHANGE' only — nothing seeds
--      INDB/USDA rows anymore (scripts/seed-foods.mjs, the only thing that
--      ever did, is removed in the same change as this migration).
--
-- Neither match_foods_batch (0016) nor match_exchange_foods_batch (0014)
-- reference f.source in their scoring logic, so relabeling does not change
-- match results. No other table has a foreign key into public.foods
-- (verified before writing this migration), so the delete is referentially
-- safe.
--
-- NOT reversible from inside the database. Export a copy first if you want
-- one to keep: `select * from public.foods where source_id not like
-- 'exchange:%'` covers everything this deletes. Restoring afterwards means
-- re-running the (now-removed) seed-foods.mjs against
-- scripts/data/indb_foods.json / usda_foods.json, which remain in git
-- history even after this change removes them from the working tree.
-- ============================================================================

-- 1. Relabel exchange rows before touching the constraint, so it is never
--    violated mid-migration.
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.foods'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%source%'
  loop
    execute format('alter table public.foods drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.foods
  add constraint foods_source_check check (source in ('INDB', 'USDA', 'EXCHANGE'));

update public.foods
set source = 'EXCHANGE'
where source_id like 'exchange:%';

-- 2. Delete everything that is not an exchange row.
delete from public.foods
where source_id not like 'exchange:%';

-- 3. Narrow the constraint now that only 'EXCHANGE' rows remain.
alter table public.foods drop constraint foods_source_check;
alter table public.foods add constraint foods_source_check check (source = 'EXCHANGE');

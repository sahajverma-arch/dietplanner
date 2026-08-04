-- ----------------------------------------------------------------------------
-- FORM DRAFTS — scope to the appointment, not just the dietitian
-- ----------------------------------------------------------------------------
-- A dietitian can have more than one counselling in flight (interrupted and
-- resumed later, or switching between two clients on the Today list). The old
-- unique key (dietitian_id, kind) gave every dietitian a single draft slot
-- shared across every client, so starting a second counselling silently
-- overwrote a first still-in-progress draft, and finishing either one deleted
-- the shared row outright. '' means "no appointment context" (form opened
-- without a Today link).

alter table public.form_drafts
  add column if not exists appointment_id text not null default '';

update public.form_drafts
  set appointment_id = coalesce(data->>'appointmentId', '')
  where appointment_id = '';

alter table public.form_drafts
  drop constraint if exists form_drafts_dietitian_id_kind_key;

alter table public.form_drafts
  add constraint form_drafts_dietitian_id_kind_appointment_id_key
  unique (dietitian_id, kind, appointment_id);

-- ============================================================================
-- COUNSELLING APPOINTMENTS — synced daily from the ops Google Sheet
-- ("Raw_Counselling") via /api/sync-counselling (triggered by QStash).
-- Dietitians see their own rows on the "Today's Activity" tab, matched by
-- profiles.employee_code = emp_code. Our workflow columns (status/client_id/
-- completed_at) are never touched by the sync — only sheet columns are.
-- Run once in the Supabase SQL Editor, after 0004.
-- ============================================================================

create table if not exists public.counselling_appointments (
  id uuid primary key default gen_random_uuid(),

  -- Columns mirrored from the sheet
  client_code text not null,
  display_name text,
  scheduled_on timestamp not null,   -- naive IST, exactly as in the sheet
  category text,
  sheet_status text,                 -- COMPLETED / PENDING / CANCELLED / DISCREPANCY
  counselling_date date,
  emp_code text not null,
  first_call timestamp,
  call_date date,
  talktime int,
  plan_name text,
  plan_type text,

  -- Our workflow columns
  status text not null default 'pending' check (status in ('pending', 'completed')),
  client_id uuid references public.clients (id) on delete set null,
  completed_at timestamptz,
  synced_at timestamptz not null default now(),

  unique (client_code, emp_code, scheduled_on)
);

create index if not exists counselling_appts_emp_sched_idx
  on public.counselling_appointments (emp_code, scheduled_on);

alter table public.counselling_appointments enable row level security;

-- Dietitians read their own schedule (matched by employee code); admins read all
create policy "appts_select_own_emp" on public.counselling_appointments
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and upper(p.employee_code) = upper(emp_code)
    )
    or public.is_admin()
  );

-- Dietitians may update only their own rows (and via column grants below,
-- only the workflow columns). Inserts/deletes are service-role only (sync).
create policy "appts_update_own_emp" on public.counselling_appointments
  for update using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and upper(p.employee_code) = upper(emp_code)
    )
  ) with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and upper(p.employee_code) = upper(emp_code)
    )
  );

revoke insert, update, delete on public.counselling_appointments from authenticated, anon;
grant update (status, client_id, completed_at) on public.counselling_appointments to authenticated;

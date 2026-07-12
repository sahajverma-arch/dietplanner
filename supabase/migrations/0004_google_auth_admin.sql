-- ============================================================================
-- Fitelo-only Google sign-in + admin role.
--   * profiles gains employee_code / phone / email / role (for data mapping
--     and the admin dashboard)
--   * signups are rejected at the database level unless the email is
--     @fitelo.co (defence in depth — the UI also restricts the Google picker)
--   * role = 'admin' unlocks read-only visibility across all dietitians;
--     column-level grants stop anyone from promoting themselves
-- Run once in the Supabase SQL Editor, after 0003.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- PROFILES — extra fields
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists email text,
  add column if not exists employee_code text,
  add column if not exists phone text,
  add column if not exists role text not null default 'dietitian';

do $$ begin
  alter table public.profiles
    add constraint profiles_role_check check (role in ('dietitian', 'admin'));
exception when duplicate_object then null; end $$;

-- Employee codes must be unique when present (case-insensitive)
create unique index if not exists profiles_employee_code_key
  on public.profiles (lower(employee_code))
  where employee_code is not null and employee_code <> '';

-- Backfill emails for accounts created before this migration
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- ----------------------------------------------------------------------------
-- SIGNUP TRIGGER — only @fitelo.co accounts may register; mirror the email
-- and take the name Google provides.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.email is null or lower(new.email) not like '%@fitelo.co' then
    raise exception 'Only fitelo.co accounts can access this platform';
  end if;

  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.email
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- ADMIN ROLE — is_admin() runs as the function owner (bypasses RLS), so the
-- profiles policies below don't recurse.
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Admins can read everything (view-only: SELECT policies, nothing else)
do $$ begin
  create policy "profiles_select_admin" on public.profiles
    for select using (public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "clients_select_admin" on public.clients
    for select using (public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "diet_plans_select_admin" on public.diet_plans
    for select using (public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "followups_select_admin" on public.followups
    for select using (public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "diet_pdfs_select_admin" on storage.objects
    for select to authenticated
    using (bucket_id = 'diet-pdfs' and public.is_admin());
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- LOCK DOWN role — users may update only their own name/employee code/phone;
-- profile rows are created by the trigger, never by clients directly.
-- ----------------------------------------------------------------------------
revoke insert, update on public.profiles from authenticated, anon;
grant update (full_name, employee_code, phone) on public.profiles to authenticated;

-- ----------------------------------------------------------------------------
-- To make someone an admin (run manually, e.g. for yourself):
--   update public.profiles set role = 'admin'
--   where email = 'rayan.ranaut@fitelo.co';
-- ----------------------------------------------------------------------------

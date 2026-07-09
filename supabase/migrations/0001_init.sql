-- ============================================================================
-- Dietitian Diet Platform — full schema, RLS and storage setup
-- Run this once in the Supabase SQL Editor (or via `supabase db push`).
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- PROFILES — one row per dietitian, mirrors auth.users
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Auto-create a profile whenever a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- CLIENTS — one row per client, owned by a dietitian; full intake kept as JSONB
-- ----------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  dietitian_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  full_name text not null,
  age int,
  gender text,
  height_cm numeric,
  weight_kg numeric,
  goal text,
  diet_type text,
  phone text,
  email text,
  intake jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_dietitian_idx on public.clients (dietitian_id);

alter table public.clients enable row level security;

create policy "clients_all_own" on public.clients
  for all
  using (dietitian_id = auth.uid())
  with check (dietitian_id = auth.uid());

-- ----------------------------------------------------------------------------
-- DIET PLANS — one row per generated weekly plan (JSON + PDF path)
-- ----------------------------------------------------------------------------
create table if not exists public.diet_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  dietitian_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  week_number int not null default 1,
  source text not null default 'first_counselling'
    check (source in ('first_counselling', 'follow_up')),
  plan jsonb not null,
  pdf_path text,
  created_at timestamptz not null default now()
);

create index if not exists diet_plans_client_idx on public.diet_plans (client_id);
create index if not exists diet_plans_dietitian_idx on public.diet_plans (dietitian_id);

alter table public.diet_plans enable row level security;

create policy "diet_plans_all_own" on public.diet_plans
  for all
  using (dietitian_id = auth.uid())
  with check (dietitian_id = auth.uid());

-- ----------------------------------------------------------------------------
-- FOLLOWUPS — weekly check-in data used to generate the next plan
-- ----------------------------------------------------------------------------
create table if not exists public.followups (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  dietitian_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  week_number int not null,
  weight_kg numeric,
  adherence text,
  complaints text,
  notes text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists followups_client_idx on public.followups (client_id);

alter table public.followups enable row level security;

create policy "followups_all_own" on public.followups
  for all
  using (dietitian_id = auth.uid())
  with check (dietitian_id = auth.uid());

-- ----------------------------------------------------------------------------
-- FORM DRAFTS — live autosave of the first-counselling form during the call
-- ----------------------------------------------------------------------------
create table if not exists public.form_drafts (
  id uuid primary key default gen_random_uuid(),
  dietitian_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null default 'first_counselling',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (dietitian_id, kind)
);

alter table public.form_drafts enable row level security;

create policy "form_drafts_all_own" on public.form_drafts
  for all
  using (dietitian_id = auth.uid())
  with check (dietitian_id = auth.uid());

-- ----------------------------------------------------------------------------
-- STORAGE — private bucket for generated PDFs.
-- Object paths are "<dietitian_id>/<client_id>/week-N-<ts>.pdf", so the first
-- folder segment must equal the caller's auth.uid().
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('diet-pdfs', 'diet-pdfs', false)
on conflict (id) do nothing;

create policy "diet_pdfs_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'diet-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "diet_pdfs_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'diet-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "diet_pdfs_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'diet-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'diet-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "diet_pdfs_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'diet-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

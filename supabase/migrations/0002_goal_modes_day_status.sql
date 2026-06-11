-- Migration: kg goal-rate unit, custom TDEE mode, and per-day completeness.
-- Safe to run on an existing Ledger database (additive only).

alter table public.settings
  add column if not exists goal_rate_unit   text not null default 'pct',
  add column if not exists goal_rate_kg     numeric not null default 0,
  add column if not exists tdee_mode        text not null default 'dynamic',
  add column if not exists custom_kcal      numeric,
  add column if not exists custom_protein_g numeric,
  add column if not exists custom_carb_g    numeric,
  add column if not exists custom_fat_g     numeric;

create table if not exists public.day_status (
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_on date not null,
  status    text not null default 'complete',
  primary key (user_id, logged_on)
);

alter table public.day_status enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'day_status' and policyname = 'day_status_owner'
  ) then
    execute 'create policy day_status_owner on public.day_status
               for all to authenticated
               using (user_id = auth.uid())
               with check (user_id = auth.uid());';
  end if;
end $$;

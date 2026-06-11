-- Migration: weekly insights projection + saved meals.
-- Safe to run on an existing Ledger database (additive only).
-- Fresh installs already get this from schema.sql.

-- Optional target weight, used to project an ETA from the weight trend.
alter table public.settings
  add column if not exists goal_weight_kg numeric;

-- Saved meals: a named bundle of food items you can re-log in one tap.
create table if not exists public.meals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  items      jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists meals_user_idx on public.meals (user_id, created_at desc);

alter table public.meals enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'meals' and policyname = 'meals_owner'
  ) then
    execute 'create policy meals_owner on public.meals
               for all to authenticated
               using (user_id = auth.uid())
               with check (user_id = auth.uid());';
  end if;
end $$;

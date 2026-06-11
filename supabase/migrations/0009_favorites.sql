-- Migration: favorite foods. Safe to run on an existing database.

create table if not exists public.favorites (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null,
  kcal          numeric not null default 0,
  protein_g     numeric not null default 0,
  carb_g        numeric not null default 0,
  fat_g         numeric not null default 0,
  fiber_g       numeric not null default 0,
  sugar_g       numeric not null default 0,
  satfat_g      numeric not null default 0,
  sodium_mg     numeric not null default 0,
  default_grams numeric not null default 100,
  created_at    timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists favorites_user_idx on public.favorites (user_id, created_at desc);

alter table public.favorites enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'favorites' and policyname = 'favorites_owner'
  ) then
    execute 'create policy favorites_owner on public.favorites
               for all to authenticated
               using (user_id = auth.uid())
               with check (user_id = auth.uid());';
  end if;
end $$;

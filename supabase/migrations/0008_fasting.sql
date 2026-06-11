-- Migration: intermittent-fasting timer. Safe to run on an existing database.

alter table public.settings
  add column if not exists fast_target_hours integer not null default 16;

create table if not exists public.fasts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists fasts_user_idx on public.fasts (user_id, started_at desc);

alter table public.fasts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'fasts' and policyname = 'fasts_owner'
  ) then
    execute 'create policy fasts_owner on public.fasts
               for all to authenticated
               using (user_id = auth.uid())
               with check (user_id = auth.uid());';
  end if;
end $$;

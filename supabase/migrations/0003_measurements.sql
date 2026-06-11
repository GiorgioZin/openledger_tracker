-- Migration: body measurements. Safe to run on an existing database.

create table if not exists public.measurements (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_on  date not null default current_date,
  kind       text not null,
  value      numeric not null,
  created_at timestamptz not null default now()
);

create index if not exists measurements_user_kind_idx on public.measurements (user_id, kind, logged_on);

alter table public.measurements enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'measurements' and policyname = 'measurements_owner'
  ) then
    execute 'create policy measurements_owner on public.measurements
               for all to authenticated
               using (user_id = auth.uid())
               with check (user_id = auth.uid());';
  end if;
end $$;

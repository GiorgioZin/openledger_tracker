-- Migration: one-tap water tracking + a daily hydration goal. Additive.

create table if not exists public.water_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_on  date not null default current_date,
  ml         integer not null,
  created_at timestamptz not null default now()
);
create index if not exists water_log_user_day_idx on public.water_log (user_id, logged_on);

alter table public.water_log enable row level security;
do $$ begin
  create policy water_log_owner on public.water_log
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

alter table public.settings add column if not exists water_goal_ml integer not null default 2500;

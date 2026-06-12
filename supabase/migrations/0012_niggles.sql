-- Migration: injuries / niggles tracker — log aches and their intensity. Additive.

create table if not exists public.niggles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area       text not null,
  intensity  int not null check (intensity between 1 and 10),
  note       text,
  logged_on  date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists niggles_user_idx on public.niggles (user_id, logged_on desc);

alter table public.niggles enable row level security;
do $$ begin
  create policy niggles_owner on public.niggles
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

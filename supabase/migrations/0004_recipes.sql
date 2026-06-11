-- Migration: recipes (composite foods). Safe to run on an existing database.

create table if not exists public.recipes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  servings   integer not null default 1,
  items      jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists recipes_user_idx on public.recipes (user_id, created_at desc);

alter table public.recipes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'recipes' and policyname = 'recipes_owner'
  ) then
    execute 'create policy recipes_owner on public.recipes
               for all to authenticated
               using (user_id = auth.uid())
               with check (user_id = auth.uid());';
  end if;
end $$;

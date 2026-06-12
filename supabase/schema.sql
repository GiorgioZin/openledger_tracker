-- Ledger schema (Postgres / Supabase)
-- Single-user app: every row is owned by a user_id and locked down with RLS.
-- Run this in the Supabase SQL editor on a fresh project.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Cached nutrition facts (pulled from Open Food Facts, per 100 g).
create table if not exists public.foods (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  barcode     text,
  name        text not null,
  brand       text,
  kcal        numeric not null,          -- per 100 g
  protein_g   numeric not null default 0,
  carb_g      numeric not null default 0,
  fat_g       numeric not null default 0,
  fiber_g     numeric not null default 0, -- per 100 g
  sugar_g     numeric not null default 0,
  satfat_g    numeric not null default 0,
  sodium_mg   numeric not null default 0,
  source      text not null default 'openfoodfacts',
  fetched_at  timestamptz not null default now()
);

-- What you ate. Macros are denormalized so historical rows stay correct
-- even if a food's upstream data later changes.
create table if not exists public.food_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_on  date not null default current_date,
  food_id    uuid references public.foods (id) on delete set null,
  name       text not null,             -- snapshot of the food name at log time
  grams      numeric not null,
  kcal       numeric not null,
  protein_g  numeric not null default 0,
  carb_g     numeric not null default 0,
  fat_g      numeric not null default 0,
  fiber_g    numeric not null default 0,
  sugar_g    numeric not null default 0,
  satfat_g   numeric not null default 0,
  sodium_mg  numeric not null default 0,
  meal       text,                       -- 'breakfast' | 'lunch' | 'dinner' | 'snack' | null
  created_at timestamptz not null default now()
);

-- Bodyweight, entered manually. One row per day (upserted).
create table if not exists public.weight_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_on  date not null default current_date,
  kg         numeric not null,
  source     text not null default 'manual',
  created_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

-- Strength training.
create table if not exists public.workouts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  performed_on date not null default current_date,
  notes        text,
  created_at   timestamptz not null default now()
);

create table if not exists public.workout_sets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id  uuid not null references public.workouts (id) on delete cascade,
  exercise    text not null,
  set_index   int not null,
  weight_kg   numeric,
  reps        int,
  rpe         numeric,
  setup       text,
  note        text
);

-- Adaptive engine output, one row per day it runs.
create table if not exists public.targets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  computed_on     date not null default current_date,
  tdee_est        numeric,
  target_kcal     numeric,
  protein_g       numeric,
  carb_g          numeric,
  fat_g           numeric,
  trend_kg        numeric,
  weekly_slope_kg numeric,
  unique (user_id, computed_on)
);

-- Goal settings (single row per user). Drives the adaptive engine.
create table if not exists public.settings (
  user_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  goal_rate_pct  numeric not null default 0,   -- weekly bodyweight change, % (neg = cut)
  goal_rate_unit text not null default 'pct',  -- 'pct' (%/wk) or 'kg' (kg/wk)
  goal_rate_kg   numeric not null default 0,   -- weekly bodyweight change, kg (neg = cut)
  goal_weight_kg numeric,                       -- optional target weight, for ETA projection
  tdee_mode      text not null default 'dynamic', -- 'dynamic' (adaptive) or 'custom'
  activity_level text not null default 'moderate', -- sedentary|light|moderate|active|very_active
  daily_steps    integer not null default 0,      -- average steps/day, feeds the estimate
  water_goal_ml  integer not null default 2500,    -- daily hydration goal
  custom_kcal     numeric,                      -- used when tdee_mode = 'custom'
  custom_protein_g numeric,
  custom_carb_g    numeric,
  custom_fat_g     numeric,
  updated_at     timestamptz not null default now()
);

-- Per-day logging completeness. Absent row = 'complete'. Days marked 'partial'
-- or 'unlogged' are excluded from the adaptive TDEE average.
create table if not exists public.day_status (
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_on date not null,
  status    text not null default 'complete',  -- 'complete' | 'partial' | 'unlogged'
  primary key (user_id, logged_on)
);

-- Body measurements (waist, chest, etc.), entered manually over time.
create table if not exists public.measurements (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_on  date not null default current_date,
  kind       text not null,                -- e.g. 'waist', 'chest', 'hips'
  value      numeric not null,             -- cm
  created_at timestamptz not null default now()
);

-- Saved meals: a named bundle of food items you can re-log in one tap.
-- Items are denormalized per-portion (same shape as food_log entries).
create table if not exists public.meals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  items      jsonb not null default '[]',  -- [{name, grams, kcal, protein_g, carb_g, fat_g}]
  created_at timestamptz not null default now()
);

-- Favorite foods: pinned items (per 100 g) for instant logging.
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

-- One-tap hydration tracking.
create table if not exists public.water_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_on  date not null default current_date,
  ml         integer not null,
  created_at timestamptz not null default now()
);

-- Injuries / niggles: track aches and their intensity over time.
create table if not exists public.niggles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area       text not null,
  intensity  int not null check (intensity between 1 and 10),
  note       text,
  logged_on  date not null default current_date,
  created_at timestamptz not null default now()
);

-- Recipes: composite foods made of ingredients, divided into servings. Logging
-- a serving adds (recipe total / servings) to the food log.
create table if not exists public.recipes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  servings   integer not null default 1,
  items      jsonb not null default '[]',  -- ingredients, per-portion as entered
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists food_log_user_date_idx   on public.food_log (user_id, logged_on);
create index if not exists weight_log_user_date_idx  on public.weight_log (user_id, logged_on);
create index if not exists workouts_user_date_idx    on public.workouts (user_id, performed_on);
create index if not exists workout_sets_workout_idx  on public.workout_sets (workout_id);
create index if not exists foods_user_barcode_idx    on public.foods (user_id, barcode);
create index if not exists meals_user_idx             on public.meals (user_id, created_at desc);
create index if not exists measurements_user_kind_idx  on public.measurements (user_id, kind, logged_on);
create index if not exists recipes_user_idx            on public.recipes (user_id, created_at desc);
create index if not exists favorites_user_idx          on public.favorites (user_id, created_at desc);
create index if not exists water_log_user_day_idx       on public.water_log (user_id, logged_on);
create index if not exists niggles_user_idx             on public.niggles (user_id, logged_on desc);

-- ---------------------------------------------------------------------------
-- Row-level security: a user only ever sees their own rows.
-- ---------------------------------------------------------------------------
alter table public.foods        enable row level security;
alter table public.food_log     enable row level security;
alter table public.weight_log   enable row level security;
alter table public.workouts     enable row level security;
alter table public.workout_sets enable row level security;
alter table public.targets      enable row level security;
alter table public.settings     enable row level security;
alter table public.meals        enable row level security;
alter table public.day_status   enable row level security;
alter table public.measurements enable row level security;
alter table public.recipes      enable row level security;
alter table public.favorites    enable row level security;
alter table public.water_log    enable row level security;
alter table public.niggles      enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'foods','food_log','weight_log','workouts','workout_sets','targets','settings','meals','day_status','measurements','recipes','favorites','water_log','niggles'
  ] loop
    execute format(
      'create policy %1$I_owner on public.%1$I
         for all to authenticated
         using (user_id = auth.uid())
         with check (user_id = auth.uid());', t);
  end loop;
end $$;

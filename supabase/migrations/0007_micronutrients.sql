-- Migration: micronutrients (fiber, sugar, saturated fat, sodium).
-- Safe to run on an existing database (additive only).

alter table public.foods
  add column if not exists fiber_g   numeric not null default 0,
  add column if not exists sugar_g   numeric not null default 0,
  add column if not exists satfat_g  numeric not null default 0,
  add column if not exists sodium_mg numeric not null default 0;

alter table public.food_log
  add column if not exists fiber_g   numeric not null default 0,
  add column if not exists sugar_g   numeric not null default 0,
  add column if not exists satfat_g  numeric not null default 0,
  add column if not exists sodium_mg numeric not null default 0;

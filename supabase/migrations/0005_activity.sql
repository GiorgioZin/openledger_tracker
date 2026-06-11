-- Migration: activity level + average daily steps (feed the TDEE estimate).
-- Safe to run on an existing database (additive only).

alter table public.settings
  add column if not exists activity_level text not null default 'moderate',
  add column if not exists daily_steps    integer not null default 0;

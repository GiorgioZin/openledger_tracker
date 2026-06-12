-- Migration: remove the fasting feature. Safe to run on an existing database.

drop table if exists public.fasts;
alter table public.settings drop column if exists fast_target_hours;

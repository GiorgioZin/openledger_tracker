-- Migration: meal categories on food log entries. Safe to run on existing data.

alter table public.food_log
  add column if not exists meal text; -- 'breakfast' | 'lunch' | 'dinner' | 'snack' | null

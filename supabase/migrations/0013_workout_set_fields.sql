-- Add per-set technical fields to workout_sets:
--   setup: a technical variant of the lift (e.g. "Close grip", "Paused")
--   note:  a free-form note for the individual set
alter table public.workout_sets add column if not exists setup text;
alter table public.workout_sets add column if not exists note text;

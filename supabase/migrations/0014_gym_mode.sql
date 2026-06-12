-- Add a lightweight Home vs Gym mode to settings. Drives the exercise
-- suggestion list on the Workouts page (convenience only, free text still allowed).
alter table public.settings add column if not exists gym_mode text not null default 'gym';

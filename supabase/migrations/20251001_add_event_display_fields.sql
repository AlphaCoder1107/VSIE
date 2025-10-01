-- Add optional display fields for seminar_events (safe if run multiple times)
alter table if exists public.seminar_events add column if not exists image_url text;
alter table if exists public.seminar_events add column if not exists title text;
alter table if exists public.seminar_events add column if not exists excerpt text;
alter table if exists public.seminar_events add column if not exists date text; -- keep as text for flexibility
alter table if exists public.seminar_events add column if not exists location text;

-- Make sure PostgREST refreshes
select pg_notify('pgrst', 'reload schema');

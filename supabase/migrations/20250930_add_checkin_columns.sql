-- Add check-in columns for seminar registrations
-- Safe to run multiple times due to IF NOT EXISTS

alter table if exists public.seminar_registrations
  add column if not exists checked_in boolean not null default false,
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by text;

-- Optional helpful index for frequent queries
create index if not exists seminar_registrations_checked_in_idx on public.seminar_registrations(checked_in);
create index if not exists seminar_registrations_checked_in_at_idx on public.seminar_registrations(checked_in_at);

-- Invalidate PostgREST schema cache so new columns are available immediately
-- (Supabase PostgREST listens to this channel)
select pg_notify('pgrst', 'reload schema');

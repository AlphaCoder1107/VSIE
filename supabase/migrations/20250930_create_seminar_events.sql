-- Create a canonical events table to drive check-in dropdowns
create table if not exists public.seminar_events (
  slug text primary key,
  name text,
  price_paise integer default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists seminar_events_active_idx on public.seminar_events(active);
create index if not exists seminar_events_created_idx on public.seminar_events(created_at desc);

-- Ensure PostgREST sees new table
select pg_notify('pgrst', 'reload schema');

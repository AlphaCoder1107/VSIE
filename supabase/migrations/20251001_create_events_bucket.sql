-- Create dedicated 'events' storage bucket
insert into storage.buckets (id, name, public) values ('events', 'events', true)
on conflict (id) do nothing;

-- Public read for events bucket
drop policy if exists "Public read events" on storage.objects;
create policy "Public read events" on storage.objects for select using (bucket_id = 'events');

-- (Optional) authenticated write to events bucket for any key (we enforce path in edge func)
drop policy if exists "Authenticated write events" on storage.objects;
create policy "Authenticated write events" on storage.objects for insert to authenticated with check (bucket_id = 'events');
drop policy if exists "Authenticated update events" on storage.objects;
create policy "Authenticated update events" on storage.objects for update to authenticated using (bucket_id = 'events') with check (bucket_id = 'events');
drop policy if exists "Authenticated delete events" on storage.objects;
create policy "Authenticated delete events" on storage.objects for delete to authenticated using (bucket_id = 'events');

select pg_notify('pgrst', 'reload schema');

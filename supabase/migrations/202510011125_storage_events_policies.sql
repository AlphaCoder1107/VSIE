-- Ensure bucket exists
insert into storage.buckets (id, name, public) values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- Public read from attachments bucket
drop policy if exists "Public read attachments" on storage.objects;
create policy "Public read attachments"
on storage.objects for select
using (bucket_id = 'attachments');

-- Authenticated users can upload to events/* path
drop policy if exists "Authenticated upload events" on storage.objects;
create policy "Authenticated upload events"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'attachments' and (
    position('events/' in coalesce(name,'')) = 1 -- key begins with events/
  )
);

-- Authenticated users can update/delete their events/* objects (optional)
drop policy if exists "Authenticated update events" on storage.objects;
create policy "Authenticated update events"
on storage.objects for update to authenticated
using (bucket_id = 'attachments' and position('events/' in coalesce(name,'')) = 1)
with check (bucket_id = 'attachments' and position('events/' in coalesce(name,'')) = 1);

drop policy if exists "Authenticated delete events" on storage.objects;
create policy "Authenticated delete events"
on storage.objects for delete to authenticated
using (bucket_id = 'attachments' and position('events/' in coalesce(name,'')) = 1);

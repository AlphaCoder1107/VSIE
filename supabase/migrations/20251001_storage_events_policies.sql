-- Ensure bucket exists
insert into storage.buckets (id, name, public) values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- Public read from attachments bucket
create policy if not exists "Public read attachments"
on storage.objects for select
using (bucket_id = 'attachments');

-- Authenticated users can upload to events/* path
create policy if not exists "Authenticated upload events"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'attachments' and (
    position('events/' in coalesce(name,'')) = 1 -- key begins with events/
  )
);

-- Authenticated users can update/delete their events/* objects (optional)
create policy if not exists "Authenticated update events"
on storage.objects for update to authenticated
using (bucket_id = 'attachments' and position('events/' in coalesce(name,'')) = 1)
with check (bucket_id = 'attachments' and position('events/' in coalesce(name,'')) = 1);

create policy if not exists "Authenticated delete events"
on storage.objects for delete to authenticated
using (bucket_id = 'attachments' and position('events/' in coalesce(name,'')) = 1);

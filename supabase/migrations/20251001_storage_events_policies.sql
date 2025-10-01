-- Ensure storage schema exists
create schema if not exists storage;

-- Create bucket attachments if missing (id must match your env)
insert into storage.buckets (id, name, public) values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- Allow public read of objects in attachments bucket (read only)
drop policy if exists "Public read attachments" on storage.objects;
create policy "Public read attachments"
on storage.objects for select
using (bucket_id = 'attachments');

-- Allow authenticated users to upload/update/delete their objects under events/* path
-- You can tighten this to role checks or email allowlists if desired
drop policy if exists "Authenticated write events prefix" on storage.objects;
create policy "Authenticated write events prefix"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'attachments' and (position('events/' in coalesce(name,'')) = 1)
);

drop policy if exists "Authenticated update events prefix" on storage.objects;
create policy "Authenticated update events prefix"
on storage.objects for update
to authenticated
using (
  bucket_id = 'attachments' and (position('events/' in coalesce(name,'')) = 1)
)
with check (
  bucket_id = 'attachments' and (position('events/' in coalesce(name,'')) = 1)
);

drop policy if exists "Authenticated delete events prefix" on storage.objects;
create policy "Authenticated delete events prefix"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'attachments' and (position('events/' in coalesce(name,'')) = 1)
);

-- Ensure bucket is public
update storage.buckets set public = true where id = 'attachments';

-- Ensure PostgREST picks up changes
select pg_notify('pgrst', 'reload schema');

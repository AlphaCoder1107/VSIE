update storage.buckets set public = true where id = 'attachments';
select pg_notify('pgrst','reload schema');

-- Admin-uploaded artwork for Overview lines, as an alternative to picking one
-- of the built-in icons. Public read because every rep has to see it and the
-- images are decoration, not data.
--
-- Deliberately narrow: 256 KB and raster images only. The client downscales to
-- 128px before upload, so anything near the ceiling is a mistake. SVG is left
-- out on purpose — it can carry script, and a public object URL would run it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gamification-icons', 'gamification-icons', true, 262144,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists gamification_icons_public_read on storage.objects;
create policy gamification_icons_public_read
  on storage.objects for select
  to public
  using (bucket_id = 'gamification-icons');

drop policy if exists gamification_icons_auth_write on storage.objects;
create policy gamification_icons_auth_write
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'gamification-icons');

drop policy if exists gamification_icons_auth_update on storage.objects;
create policy gamification_icons_auth_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'gamification-icons');

drop policy if exists gamification_icons_auth_delete on storage.objects;
create policy gamification_icons_auth_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'gamification-icons');

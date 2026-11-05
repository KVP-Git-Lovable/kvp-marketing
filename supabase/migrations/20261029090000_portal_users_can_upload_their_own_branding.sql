-- A distributor uploading their own logo was refused by storage.
--
-- Every write policy on company-assets required has_role(auth.uid(),'admin'),
-- which a distributor portal user is not, so the upload failed with "new row
-- violates row-level security policy". The distributors table already allows
-- "Portal users update own distributor only", so saving logo_url worked --
-- only the file itself was blocked.
--
-- Scoped to their own folder: distributor-logos/<distributor_id>/<file> and
-- distributor-qr-codes/<distributor_id>/<file>. A portal user cannot write
-- outside it, and cannot touch another distributor's branding.

create policy "Portal users upload own branding"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] in ('distributor-logos', 'distributor-qr-codes')
  and (storage.foldername(name))[2] = get_distributor_id_for_auth_user()::text
);

create policy "Portal users replace own branding"
on storage.objects for update to authenticated
using (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] in ('distributor-logos', 'distributor-qr-codes')
  and (storage.foldername(name))[2] = get_distributor_id_for_auth_user()::text
)
with check (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] in ('distributor-logos', 'distributor-qr-codes')
  and (storage.foldername(name))[2] = get_distributor_id_for_auth_user()::text
);

create policy "Portal users remove own branding"
on storage.objects for delete to authenticated
using (
  bucket_id = 'company-assets'
  and (storage.foldername(name))[1] in ('distributor-logos', 'distributor-qr-codes')
  and (storage.foldername(name))[2] = get_distributor_id_for_auth_user()::text
);

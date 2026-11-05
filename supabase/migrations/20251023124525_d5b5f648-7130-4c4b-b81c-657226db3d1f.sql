-- Policies for visit-photos access
CREATE POLICY "ops_admins_view_visit_photos_20251023"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'visit-photos'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "owners_view_own_visit_photos_20251023"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'visit-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "owners_upload_visit_photos_20251023"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'visit-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

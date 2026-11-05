
-- ========================================
-- COMPANY-ASSETS: Admin-only writes
-- ========================================

-- Drop permissive policies
DROP POLICY IF EXISTS "Authenticated users can upload company assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update company assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete company assets" ON storage.objects;

-- Replace with admin-only
CREATE POLICY "Admins can upload company assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'company-assets'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can update company assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'company-assets'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can delete company assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'company-assets'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- ========================================
-- VISIT-PHOTOS: Owner + Admin scoping
-- ========================================

-- Drop permissive policies
DROP POLICY IF EXISTS "Users can view visit photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload visit photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update visit photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete visit photos" ON storage.objects;

-- SELECT: Owner folder OR admin
CREATE POLICY "Owner or admin can view visit photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'visit-photos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

-- INSERT: Owner folder only
CREATE POLICY "Owner can upload visit photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'visit-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- UPDATE: Owner folder only
CREATE POLICY "Owner can update visit photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'visit-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE: Owner folder OR admin
CREATE POLICY "Owner or admin can delete visit photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'visit-photos'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

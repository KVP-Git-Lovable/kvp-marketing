-- Secure vendors SELECT access: restrict to authenticated users only
-- 1) Drop overly permissive policy
DROP POLICY IF EXISTS "Vendors are viewable by authenticated users" ON public.vendors;

-- 2) Create least-privilege SELECT policy scoped to authenticated role
CREATE POLICY "Authenticated users can view vendors"
ON public.vendors
FOR SELECT
TO authenticated
USING (true);

-- Note: existing admin management policy remains unchanged
-- This change prevents anonymous/public access while preserving app functionality for signed-in users.
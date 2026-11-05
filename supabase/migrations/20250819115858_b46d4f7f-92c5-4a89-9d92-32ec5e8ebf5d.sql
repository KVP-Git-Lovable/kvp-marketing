-- Secure vendors table: restrict public reads and limit non-admins to approved vendors only

-- 1) Remove overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view vendors" ON public.vendors;

-- Ensure RLS is enabled (defensive)
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- 2) Allow only authenticated users to view approved vendors
CREATE POLICY "Authenticated users can view approved vendors"
ON public.vendors
FOR SELECT
USING (auth.uid() IS NOT NULL AND is_approved = true);

-- Note: Admins retain full access via existing "Admins can manage vendors" (ALL) policy
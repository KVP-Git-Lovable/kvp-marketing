-- Drop the restrictive SELECT policy on vendors
DROP POLICY IF EXISTS "Only admins can view vendor data directly" ON public.vendors;

-- Create a permissive SELECT policy for all authenticated users
CREATE POLICY "Authenticated users can view vendors" 
ON public.vendors 
FOR SELECT 
TO authenticated
USING (true);

-- Also check and fix distributors SELECT policy
DROP POLICY IF EXISTS "Admins can view all distributors" ON public.distributors;

-- Drop existing authenticated select policy if it exists
DROP POLICY IF EXISTS "Authenticated users can view all distributors" ON public.distributors;

-- Make sure authenticated users can view all distributors
CREATE POLICY "Authenticated users can view all distributors" 
ON public.distributors 
FOR SELECT 
TO authenticated
USING (true);
-- Drop the policy if it exists, then create it
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Allow admins to view all profiles in Operations Dashboard
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
);
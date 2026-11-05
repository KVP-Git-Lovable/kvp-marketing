-- Harden access to sensitive invitation data
-- 1) Create a SECURITY DEFINER helper to safely fetch the authenticated user's email
CREATE OR REPLACE FUNCTION public.get_authenticated_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

-- 2) Replace lenient invited-user policy with a stricter version that relies on server-side email lookup
DROP POLICY IF EXISTS "Invited users can view their invitation" ON public.user_invitations;

CREATE POLICY "Invited authenticated user can view their own invitation"
ON public.user_invitations
FOR SELECT
TO authenticated
USING (
  public.get_authenticated_email() IS NOT NULL
  AND public.get_authenticated_email() = email
);

-- Keep existing admin manage policy intact (already grants ALL to admins)
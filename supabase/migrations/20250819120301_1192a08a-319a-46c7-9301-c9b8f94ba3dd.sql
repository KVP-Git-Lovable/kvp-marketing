-- Harden user_invitations access: admins only for manage, invited user can view own row

-- Ensure RLS is enabled
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Recreate admin policy with USING and WITH CHECK to avoid gaps
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.user_invitations;
CREATE POLICY "Admins can manage invitations"
ON public.user_invitations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow invited users (authenticated) to view only their own invitation by email
DROP POLICY IF EXISTS "Invited users can view their invitation" ON public.user_invitations;
CREATE POLICY "Invited users can view their invitation"
ON public.user_invitations
FOR SELECT
USING ((auth.jwt() ->> 'email') = email);

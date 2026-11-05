-- First, drop all existing non-admin policies to start fresh
DROP POLICY IF EXISTS "Token validation access only" ON public.user_invitations;
DROP POLICY IF EXISTS "Users can view only their own completed invitation" ON public.user_invitations;
DROP POLICY IF EXISTS "Only admins can create invitations" ON public.user_invitations;
DROP POLICY IF EXISTS "Only system and admins can update invitations" ON public.user_invitations;

-- Create secure functions for invitation access control
CREATE OR REPLACE FUNCTION public.can_access_invitation(_invitation_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_invitations 
    WHERE invitation_token = _invitation_token
      AND status = 'pending'
      AND expires_at > now()
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_completed_invitation(_user_id uuid, _email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM auth.users
    WHERE id = _user_id 
      AND email = _email
  );
$$;

-- Highly restrictive policy: No direct SELECT access for regular users
-- All invitation access must go through edge functions
CREATE POLICY "No direct user access to invitations" 
ON public.user_invitations 
FOR SELECT 
USING (false);

-- Only admins can create invitations
CREATE POLICY "Admin only invitation creation" 
ON public.user_invitations 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Only admins can update invitations
CREATE POLICY "Admin only invitation updates" 
ON public.user_invitations 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role)
);
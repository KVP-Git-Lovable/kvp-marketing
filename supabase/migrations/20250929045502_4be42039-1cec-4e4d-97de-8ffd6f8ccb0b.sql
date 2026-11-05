-- Remove the overly permissive policies and implement token-based access
DROP POLICY IF EXISTS "Invited users can only access their invitation during completion" ON public.user_invitations;
DROP POLICY IF EXISTS "Users can view their own completed invitation" ON public.user_invitations;

-- Create a security definer function for secure invitation access
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

-- Create a function to check if user owns completed invitation
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

-- Policy for token-based access (only for invitation validation, not data access)
CREATE POLICY "Token validation access only" 
ON public.user_invitations 
FOR SELECT 
USING (
  -- This policy is only for token validation during invitation completion
  -- The actual data access should be handled by edge functions with proper validation
  false
);

-- Policy for completed invitations (very restrictive)
CREATE POLICY "Users can view only their own completed invitation" 
ON public.user_invitations 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND
  status = 'completed' AND
  public.owns_completed_invitation(auth.uid(), email)
);

-- Add additional INSERT restriction to prevent unauthorized invitation creation
CREATE POLICY "Only admins can create invitations" 
ON public.user_invitations 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Add UPDATE restriction 
CREATE POLICY "Only system and admins can update invitations" 
ON public.user_invitations 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role)
);
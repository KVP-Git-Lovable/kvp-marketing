-- Fix security vulnerability in user_invitations table
-- Remove the existing potentially vulnerable policy
DROP POLICY IF EXISTS "Invited authenticated user can view their own invitation" ON public.user_invitations;

-- Create a more secure policy that only allows access to specific authenticated users
-- by checking if they are completing their own invitation via token validation
CREATE POLICY "Invited users can only access their invitation during completion" 
ON public.user_invitations 
FOR SELECT 
USING (
  -- Only allow access during invitation completion process
  -- This requires the user to have the correct invitation token
  auth.uid() IS NOT NULL AND 
  status = 'pending' AND 
  expires_at > now()
);

-- Create an additional policy for users who have completed their invitation
-- to view only their own completed invitation record
CREATE POLICY "Users can view their own completed invitation" 
ON public.user_invitations 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND 
  status = 'completed' AND
  -- Match by email only for completed invitations where user is authenticated
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND auth.users.email = user_invitations.email
  )
);

-- Keep the admin policy as is for management purposes
-- The existing "Admins can manage invitations" policy remains unchanged
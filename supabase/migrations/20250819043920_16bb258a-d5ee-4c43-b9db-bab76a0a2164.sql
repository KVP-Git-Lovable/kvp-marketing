-- Tighten RLS on user_invitations to prevent public reads
DROP POLICY IF EXISTS "Users can view invitations by token" ON public.user_invitations;

-- No replacement public policy. Admins retain access via existing ALL policy.
-- Token validation will be handled via a public Edge Function that uses the service role securely.
-- Drop ALL existing policies on user_invitations except admin policy
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'user_invitations' 
        AND schemaname = 'public'
        AND policyname != 'Admins can manage invitations'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_invitations', policy_record.policyname);
    END LOOP;
END $$;

-- Now create the secure policies
CREATE POLICY "Secure invitation access" 
ON public.user_invitations 
FOR SELECT 
USING (
  -- Only allow admins or service role access
  -- Regular users cannot directly query invitation data
  has_role(auth.uid(), 'admin'::app_role)
);

-- Prevent unauthorized invitation creation
CREATE POLICY "Admin invitation creation" 
ON public.user_invitations 
FOR INSERT 
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Prevent unauthorized invitation updates  
CREATE POLICY "Admin invitation management" 
ON public.user_invitations 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role)
);

-- Create security functions for edge function use
CREATE OR REPLACE FUNCTION public.validate_invitation_token(_token text)
RETURNS TABLE(
  id uuid,
  email text,
  full_name text,
  phone_number text,
  manager_id uuid,
  expires_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ui.id,
    ui.email,
    ui.full_name,
    ui.phone_number,
    ui.manager_id,
    ui.expires_at
  FROM public.user_invitations ui
  WHERE ui.invitation_token = _token
    AND ui.status = 'pending'
    AND ui.expires_at > now()
  LIMIT 1;
$$;
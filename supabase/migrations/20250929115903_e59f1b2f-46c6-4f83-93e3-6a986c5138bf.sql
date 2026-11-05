-- Fix security warnings from the previous migration
-- Fix 1: Remove security definer view and replace with proper function-based access
DROP VIEW IF EXISTS public.vendors_public;

-- Fix 2: Add SET search_path to functions that are missing it
-- Update the existing functions to include proper search_path settings

-- Fix verify_hint_answer function
CREATE OR REPLACE FUNCTION public.verify_hint_answer(user_email text, submitted_answer text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  stored_answer text;
BEGIN
  SELECT p.hint_answer INTO stored_answer
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE u.email = user_email;
  
  RETURN LOWER(TRIM(stored_answer)) = LOWER(TRIM(submitted_answer));
END;
$$;

-- Fix has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Fix get_user_role function  
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Fix can_access_invitation function
CREATE OR REPLACE FUNCTION public.can_access_invitation(_invitation_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_invitations 
    WHERE invitation_token = _invitation_token
      AND status = 'pending'
      AND expires_at > now()
  );
$$;

-- Ensure all new functions have proper search_path
-- get_vendors_public_info already has SET search_path = public
-- get_vendor_contact_info already has SET search_path = public

-- Create a secure function for regular users to access vendor data without contact info
CREATE OR REPLACE FUNCTION public.get_public_vendors()
RETURNS TABLE(
  id uuid,
  name text,
  skills text[],
  region_pincodes text[],
  city text,
  state text,
  is_approved boolean,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    v.id,
    v.name,
    v.skills,
    v.region_pincodes,
    v.city,
    v.state,
    v.is_approved,
    v.created_at
  FROM public.vendors v
  WHERE v.is_approved = true
    AND auth.uid() IS NOT NULL;
$$;

-- Security documentation
COMMENT ON FUNCTION public.get_public_vendors() IS 
'Returns non-sensitive vendor information for authenticated users. Excludes contact details to prevent competitor data theft.';

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_public_vendors() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vendor_contact_info(uuid) TO authenticated;
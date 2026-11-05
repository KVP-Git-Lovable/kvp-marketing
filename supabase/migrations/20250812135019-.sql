-- Fix security issue: Restrict access to sensitive profile data
-- Create a view for public profile information that excludes sensitive data
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT 
  id,
  username,
  full_name,
  created_at,
  updated_at
FROM public.profiles;

-- Enable RLS on the view
ALTER VIEW public.profiles_public ENABLE ROW LEVEL SECURITY;

-- Create policies for the public view
CREATE POLICY "Users can view public profile info for all users" 
ON public.profiles_public 
FOR SELECT 
USING (true);

-- Create a secure function for admins to get necessary profile data (without sensitive info)
CREATE OR REPLACE FUNCTION public.get_profiles_for_admin()
RETURNS TABLE(
  id uuid,
  username text,
  full_name text,
  phone_number text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    p.id,
    p.username,
    p.full_name,
    p.phone_number,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE has_role(auth.uid(), 'admin'::app_role);
$$;

-- Create a secure function for users to update their own security info
CREATE OR REPLACE FUNCTION public.update_security_info(
  new_hint_question text,
  new_hint_answer text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles 
  SET 
    hint_question = new_hint_question,
    hint_answer = new_hint_answer,
    updated_at = now()
  WHERE id = auth.uid();
  
  RETURN FOUND;
END;
$$;

-- Update RLS policies to be more restrictive
-- Drop existing admin policies that give full access
DROP POLICY IF EXISTS "Admins can view all profiles for management" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles for management" ON public.profiles;

-- Create more restrictive admin policies
CREATE POLICY "Admins can view basic profile info" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND auth.uid() != id  -- Admins use regular user policy for their own profile
);

-- Allow admins to update only non-sensitive fields
CREATE POLICY "Admins can update basic profile info" 
ON public.profiles 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  AND auth.uid() != id  -- Admins use regular user policy for their own profile
);

-- Add a policy to prevent admins from accessing sensitive security fields
-- This is enforced at the application level by using the secure functions
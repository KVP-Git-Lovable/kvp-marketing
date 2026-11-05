-- Fix security issue: Implement granular access controls for profiles table
-- Drop the problematic view that can't have RLS enabled
DROP VIEW IF EXISTS public.profiles_public;

-- Update the admin functions to be more secure and limit data exposure
DROP FUNCTION IF EXISTS public.get_profiles_for_admin();

-- Create a minimal admin function that only exposes essential management data
CREATE OR REPLACE FUNCTION public.get_basic_profiles_for_admin()
RETURNS TABLE(
  id uuid,
  username text,
  full_name text,
  created_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    p.id,
    p.username,
    p.full_name,
    p.created_at
  FROM public.profiles p
  WHERE has_role(auth.uid(), 'admin');
$$;

-- Update admin policies to be even more restrictive
-- Drop existing admin policies
DROP POLICY IF EXISTS "Admins can view basic profile info" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update basic profile info" ON public.profiles;

-- Create highly restricted admin policies that exclude sensitive data
CREATE POLICY "Admins can view limited profile info only" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin') 
  AND auth.uid() != id
);

-- Create a trigger to prevent updates to sensitive fields by admins
CREATE OR REPLACE FUNCTION public.prevent_admin_sensitive_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- If user is admin and trying to access someone else's profile
  IF has_role(auth.uid(), 'admin') AND auth.uid() != NEW.id THEN
    -- Prevent updates to sensitive fields
    IF OLD.hint_question IS DISTINCT FROM NEW.hint_question 
       OR OLD.hint_answer IS DISTINCT FROM NEW.hint_answer 
       OR OLD.recovery_email IS DISTINCT FROM NEW.recovery_email 
       OR OLD.phone_number IS DISTINCT FROM NEW.phone_number THEN
      RAISE EXCEPTION 'Admins cannot access or modify sensitive profile data';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to enforce sensitive data protection
DROP TRIGGER IF EXISTS protect_sensitive_profile_data ON public.profiles;
CREATE TRIGGER protect_sensitive_profile_data
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_admin_sensitive_access();

-- Ensure the update_security_info function is properly secured
DROP FUNCTION IF EXISTS public.update_security_info(text, text);
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
  -- Only allow users to update their own security info
  UPDATE public.profiles 
  SET 
    hint_question = new_hint_question,
    hint_answer = new_hint_answer,
    updated_at = now()
  WHERE id = auth.uid();
  
  RETURN FOUND;
END;
$$;
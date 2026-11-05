-- Step 1: Create a secure function to hash hint answers
CREATE OR REPLACE FUNCTION public.hash_hint_answer(answer text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use pgcrypto extension for secure hashing
  RETURN crypt(LOWER(TRIM(answer)), gen_salt('bf', 10));
END;
$$;

-- Step 2: Create a function to verify hint answers without exposing them
CREATE OR REPLACE FUNCTION public.verify_hint_answer_secure(user_email text, submitted_answer text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_hash text;
BEGIN
  -- Get the hashed hint answer
  SELECT p.hint_answer INTO stored_hash
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE u.email = user_email;
  
  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;
  
  -- Verify using crypt function
  RETURN stored_hash = crypt(LOWER(TRIM(submitted_answer)), stored_hash);
END;
$$;

-- Step 3: Create a secure function for admins to get limited profile data only
CREATE OR REPLACE FUNCTION public.get_limited_profiles_for_admin()
RETURNS TABLE(
  id uuid, 
  username text, 
  full_name text, 
  created_at timestamp with time zone,
  user_status user_status
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.username,
    p.full_name,
    p.created_at,
    p.user_status
  FROM public.profiles p
  WHERE public.has_role(auth.uid(), 'admin'::public.app_role);
$$;

-- Step 4: Drop existing overlapping policies that could expose data
DROP POLICY IF EXISTS "Admins can view all profiles for management" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles for management" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view limited profile info only" ON public.profiles;
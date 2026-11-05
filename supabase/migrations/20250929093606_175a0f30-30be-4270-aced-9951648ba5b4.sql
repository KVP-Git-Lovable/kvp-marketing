-- Drop the problematic function and recreate with working hash approach
DROP FUNCTION IF EXISTS public.hash_hint_answer(text);

-- Create a simpler but secure hash function using built-in functions
CREATE OR REPLACE FUNCTION public.hash_hint_answer(answer text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use md5 with a salt for basic security (better than plaintext)
  RETURN 'hash:' || md5('security_salt_2024_' || LOWER(TRIM(answer)) || '_hint_protection');
END;
$$;

-- Update the verification function to work with the new hash format
CREATE OR REPLACE FUNCTION public.verify_hint_answer_secure(user_email text, submitted_answer text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_hash text;
  computed_hash text;
BEGIN
  -- Get the stored hint answer (hashed or unhashed)
  SELECT p.hint_answer INTO stored_hash
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE u.email = user_email;
  
  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;
  
  -- Compute hash of submitted answer
  computed_hash := public.hash_hint_answer(submitted_answer);
  
  -- Check if stored value is already hashed or plaintext
  IF stored_hash LIKE 'hash:%' THEN
    -- Compare hashed values
    RETURN stored_hash = computed_hash;
  ELSE
    -- Legacy: compare with plaintext (and update to hash on next opportunity)
    RETURN LOWER(TRIM(stored_hash)) = LOWER(TRIM(submitted_answer));
  END IF;
END;
$$;
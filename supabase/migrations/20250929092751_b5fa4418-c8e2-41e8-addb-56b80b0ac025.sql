-- Step 5: Drop all existing policies and create secure ones
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view only their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update only their own profile non-sensitive fields" ON public.profiles;

-- Create new, more restrictive RLS policies for profiles table
CREATE POLICY "Users can view only their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update only their own profile non-sensitive fields" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Step 6: Create a function for secure security info updates
CREATE OR REPLACE FUNCTION public.update_security_info_secure(
  new_hint_question text, 
  new_hint_answer text,
  new_recovery_email text DEFAULT NULL,
  new_phone_number text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow users to update their own security info
  UPDATE public.profiles 
  SET 
    hint_question = new_hint_question,
    hint_answer = public.hash_hint_answer(new_hint_answer),
    recovery_email = COALESCE(new_recovery_email, recovery_email),
    phone_number = COALESCE(new_phone_number, phone_number),
    updated_at = now()
  WHERE id = auth.uid();
  
  RETURN FOUND;
END;
$$;
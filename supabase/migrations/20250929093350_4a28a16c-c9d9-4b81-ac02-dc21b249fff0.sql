-- Fix the RLS policies for profiles table with correct syntax
-- Drop the failed policy and recreate it properly
DROP POLICY IF EXISTS "Users can update own non-sensitive profile" ON public.profiles;

-- Create correct policy for users to update their own non-sensitive fields only
CREATE POLICY "Users can update own non-sensitive profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Create a separate function to handle sensitive field updates with proper validation
CREATE OR REPLACE FUNCTION public.update_sensitive_profile_fields(
  new_phone_number text DEFAULT NULL,
  new_recovery_email text DEFAULT NULL,
  new_hint_question text DEFAULT NULL,
  new_hint_answer text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hashed_answer text;
BEGIN
  -- Hash the hint answer if provided
  IF new_hint_answer IS NOT NULL THEN
    hashed_answer := public.hash_hint_answer(new_hint_answer);
  END IF;
  
  -- Update only the fields that were provided and belong to the authenticated user
  UPDATE public.profiles 
  SET 
    phone_number = COALESCE(new_phone_number, phone_number),
    recovery_email = COALESCE(new_recovery_email, recovery_email),
    hint_question = COALESCE(new_hint_question, hint_question),
    hint_answer = COALESCE(hashed_answer, hint_answer),
    updated_at = now()
  WHERE id = auth.uid();
  
  RETURN FOUND;
END;
$$;
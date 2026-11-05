-- Check existing RLS policies on profiles table
SELECT policyname, permissive, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'profiles' AND schemaname = 'public';

-- Check if hint_answer field is hashed
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND table_schema = 'public' 
  AND column_name IN ('hint_answer', 'phone_number', 'recovery_email');
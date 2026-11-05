-- Check for triggers on profiles table and fix any read-only transaction issues
-- First, let's see what triggers exist on the profiles table
DO $$ 
DECLARE
  trigger_record RECORD;
BEGIN
  -- Get all triggers on the profiles table
  FOR trigger_record IN 
    SELECT tgname, tgtype, proname
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE c.relname = 'profiles' AND c.relnamespace = 'public'::regnamespace
  LOOP
    RAISE NOTICE 'Trigger found: % (function: %)', trigger_record.tgname, trigger_record.proname;
  END LOOP;
END $$;

-- Ensure the handle_new_user trigger only fires on INSERT, not SELECT
-- This function should only create a profile when a new user signs up
-- Drop and recreate it to ensure it's correct
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, phone_number, recovery_email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'full_name', 'User'),
    new.raw_user_meta_data->>'phone_number',
    new.raw_user_meta_data->>'recovery_email'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- Create trigger that only fires AFTER INSERT on auth.users (not on SELECT)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- Make sure profiles table has proper RLS policies without complex functions
-- Check if there are any problematic RLS policies
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT schemaname, tablename, policyname, cmd, qual
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    RAISE NOTICE 'RLS Policy: % (command: %)', policy_record.policyname, policy_record.cmd;
  END LOOP;
END $$;

-- Create simple, efficient RLS policies for profiles
-- Drop existing policies and recreate them properly
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

-- Allow authenticated users to view all profiles (for displaying usernames)
CREATE POLICY "Users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Allow users to update only their own profile
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow users to insert only their own profile
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);
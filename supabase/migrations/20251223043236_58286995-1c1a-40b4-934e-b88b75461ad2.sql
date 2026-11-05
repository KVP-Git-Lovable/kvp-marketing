-- Drop the overly permissive "Users can view all profiles" policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Note: The "Users can view only their own profile" policy already exists
-- and restricts SELECT to auth.uid() = id, which is the correct behavior
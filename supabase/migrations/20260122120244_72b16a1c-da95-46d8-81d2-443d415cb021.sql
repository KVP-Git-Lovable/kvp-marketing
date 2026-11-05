-- Step 1: Create is_system_admin() function that checks both admin role and System Administrator profile
CREATE OR REPLACE FUNCTION public.is_system_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check if user has admin role
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'::app_role
  )
  OR EXISTS (
    -- Check if user has System Administrator security profile
    SELECT 1 FROM public.user_profiles up
    JOIN public.security_profiles sp ON sp.id = up.profile_id
    WHERE up.user_id = _user_id AND sp.name = 'System Administrator'
  )
$$;

-- Step 2: Update can_view_profile() to use is_system_admin
CREATE OR REPLACE FUNCTION public.can_view_profile(_target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (auth.uid() = _target_user_id) 
    OR is_system_admin(auth.uid());
END;
$$;

-- Step 3: Update can_view_employee() to use is_system_admin
CREATE OR REPLACE FUNCTION public.can_view_employee(_target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (auth.uid() = _target_user_id) 
    OR is_system_admin(auth.uid());
END;
$$;

-- Step 4: Update user_profiles SELECT policy
DROP POLICY IF EXISTS "Users can view their own profile assignment" ON public.user_profiles;

CREATE POLICY "Users can view profile assignments"
ON public.user_profiles FOR SELECT
TO public
USING (
  (auth.uid() = user_id) 
  OR is_system_admin(auth.uid())
);

-- Step 5: Update profiles SELECT policy for admins
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "System admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (is_system_admin(auth.uid()));

-- Step 6: Update employees policy for admin management
DROP POLICY IF EXISTS "Admins can manage employees" ON public.employees;

CREATE POLICY "System admins can manage employees"
ON public.employees FOR ALL
TO public
USING (is_system_admin(auth.uid()))
WITH CHECK (is_system_admin(auth.uid()));
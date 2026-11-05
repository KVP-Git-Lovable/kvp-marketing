
-- Phase 1a: Update is_system_admin() to check ONLY security profiles
CREATE OR REPLACE FUNCTION public.is_system_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    JOIN public.security_profiles sp ON sp.id = up.profile_id
    WHERE up.user_id = _user_id AND sp.name = 'System Administrator'
  )
$$;

-- Phase 1b: Update has_role() to redirect 'admin' checks to security profiles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF _role = 'admin'::app_role THEN
    -- For admin role checks, use security profiles instead of user_roles
    RETURN EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.security_profiles sp ON sp.id = up.profile_id
      WHERE up.user_id = _user_id AND sp.name = 'System Administrator'
    );
  ELSE
    -- For non-admin roles, keep existing behavior
    RETURN EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    );
  END IF;
END;
$$;

-- Phase 1c: Assign System Administrator profile to Abhishek KP
INSERT INTO public.user_profiles (user_id, profile_id)
VALUES (
  '6be7e2ff-0447-44a0-a3b5-64993b9db54d',
  '3385dd99-c4f7-455b-94d7-c7b5105565ce'
)
ON CONFLICT (user_id) DO UPDATE SET profile_id = EXCLUDED.profile_id;

-- Phase 1d: Change Abhishek KP's role from admin to user
UPDATE public.user_roles
SET role = 'user'
WHERE user_id = '6be7e2ff-0447-44a0-a3b5-64993b9db54d' AND role = 'admin';

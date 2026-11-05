-- Update is_system_admin to use is_system flag instead of name matching
CREATE OR REPLACE FUNCTION public.is_system_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    JOIN public.security_profiles sp ON sp.id = up.profile_id
    WHERE up.user_id = _user_id AND sp.is_system = true
  )
$$;

-- Update has_role to use is_system flag for admin check
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _role = 'admin'::app_role THEN
    RETURN EXISTS (
      SELECT 1 FROM public.user_profiles up
      JOIN public.security_profiles sp ON sp.id = up.profile_id
      WHERE up.user_id = _user_id AND sp.is_system = true
    );
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;
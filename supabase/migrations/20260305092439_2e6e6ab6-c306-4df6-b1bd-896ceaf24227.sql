
CREATE OR REPLACE FUNCTION public.get_user_profile_card(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT jsonb_build_object(
    'id', p.id,
    'full_name', p.full_name,
    'username', p.username,
    'designation', p.designation,
    'phone_number', p.phone_number,
    'profile_picture_url', p.profile_picture_url,
    'email', au.email,
    'date_of_joining', e.date_of_joining,
    'band', e.band,
    'address', e.address,
    'primary_manager_name', pm.full_name,
    'secondary_manager_name', sm.full_name,
    'role', COALESCE(ur.role::text, 'user')
  ) INTO result
  FROM profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  LEFT JOIN employees e ON e.user_id = p.id
  LEFT JOIN profiles pm ON pm.id = e.manager_id
  LEFT JOIN profiles sm ON sm.id = e.secondary_manager_id
  LEFT JOIN user_roles ur ON ur.user_id = p.id
  WHERE p.id = p_user_id;

  RETURN result;
END;
$$;

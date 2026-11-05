-- Update the get_limited_profiles_for_admin function to include profile_picture_url
DROP FUNCTION IF EXISTS public.get_limited_profiles_for_admin();

CREATE OR REPLACE FUNCTION public.get_limited_profiles_for_admin()
RETURNS TABLE(
  id uuid,
  username text,
  full_name text,
  created_at timestamp with time zone,
  user_status user_status,
  profile_picture_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    p.id,
    p.username,
    p.full_name,
    p.created_at,
    p.user_status,
    p.profile_picture_url
  FROM public.profiles p
  WHERE public.has_role(auth.uid(), 'admin'::public.app_role);
$$;
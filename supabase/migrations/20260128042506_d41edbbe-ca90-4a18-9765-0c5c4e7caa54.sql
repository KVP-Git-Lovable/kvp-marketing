-- Create a function to get basic profile info for authenticated users
-- This is used in analytics dropdowns and selectors
CREATE OR REPLACE FUNCTION public.get_profiles_for_selector()
RETURNS TABLE (id uuid, full_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.full_name
  FROM public.profiles p
  WHERE p.full_name IS NOT NULL
  ORDER BY p.full_name;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_profiles_for_selector() TO authenticated;
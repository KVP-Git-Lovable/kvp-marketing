-- Function to get distinct states
CREATE OR REPLACE FUNCTION public.get_distinct_states()
RETURNS TABLE(statename TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT pm.statename
  FROM pincode_master pm
  WHERE pm.statename IS NOT NULL
  ORDER BY pm.statename;
$$;

-- Function to get distinct districts for a state
CREATE OR REPLACE FUNCTION public.get_distinct_districts(selected_state TEXT)
RETURNS TABLE(district TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT pm.district
  FROM pincode_master pm
  WHERE pm.statename = selected_state
    AND pm.district IS NOT NULL
  ORDER BY pm.district;
$$;
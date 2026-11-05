-- Create recursive function to get all subordinates in the hierarchy
CREATE OR REPLACE FUNCTION public.get_all_subordinates(manager_user_id uuid)
RETURNS TABLE(subordinate_user_id uuid, level integer, full_name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE subordinate_tree AS (
    -- Base case: the manager themselves (level 0)
    SELECT manager_user_id as user_id, 0 as lvl
    UNION ALL
    -- Recursive case: all employees reporting to current level
    SELECT e.user_id, st.lvl + 1
    FROM employees e
    INNER JOIN subordinate_tree st ON e.manager_id = st.user_id
    WHERE e.user_id != manager_user_id -- Prevent self-reference loops
  )
  SELECT 
    st.user_id as subordinate_user_id,
    st.lvl as level,
    COALESCE(p.full_name, p.username, 'Unknown') as full_name
  FROM subordinate_tree st
  LEFT JOIN profiles p ON p.id = st.user_id
  ORDER BY st.lvl, p.full_name;
END;
$$;

-- Create helper function to check if user is a manager
CREATE OR REPLACE FUNCTION public.is_manager(user_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM employees e 
    WHERE e.manager_id = user_id_param
  );
$$;

-- Create function to get direct reports only (for performance when full hierarchy not needed)
CREATE OR REPLACE FUNCTION public.get_direct_reports(manager_user_id uuid)
RETURNS TABLE(subordinate_user_id uuid, full_name text, profile_picture_url text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    e.user_id as subordinate_user_id,
    COALESCE(p.full_name, p.username, 'Unknown') as full_name,
    p.profile_picture_url
  FROM employees e
  LEFT JOIN profiles p ON p.id = e.user_id
  WHERE e.manager_id = manager_user_id
  ORDER BY p.full_name;
$$;
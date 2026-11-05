-- Create a function to get limited employee info for dropdowns/lists (name only, no salary)
CREATE OR REPLACE FUNCTION public.get_employee_basic_info(employee_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  hq TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.user_id, p.full_name, e.hq
  FROM employees e
  LEFT JOIN profiles p ON p.id = e.user_id
  WHERE e.user_id = employee_user_id;
$$;

-- Create a function to list all team members for admin/manager views (without sensitive data like salary)
CREATE OR REPLACE FUNCTION public.list_team_members()
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  username TEXT,
  profile_picture_url TEXT,
  hq TEXT,
  manager_id UUID
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    e.user_id, 
    p.full_name, 
    p.username, 
    p.profile_picture_url,
    e.hq,
    e.manager_id
  FROM employees e
  LEFT JOIN profiles p ON p.id = e.user_id
  WHERE 
    -- Admins see everyone
    has_role(auth.uid(), 'admin'::app_role)
    -- Managers see their direct reports
    OR e.manager_id = auth.uid()
    -- Users see themselves
    OR e.user_id = auth.uid();
$$;
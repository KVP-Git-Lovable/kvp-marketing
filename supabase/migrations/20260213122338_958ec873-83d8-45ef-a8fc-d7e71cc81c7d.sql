
-- Update can_view_employee to allow managers to see subordinates' employee records
CREATE OR REPLACE FUNCTION public.can_view_employee(_target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Own record
  IF auth.uid() = _target_user_id THEN
    RETURN true;
  END IF;
  
  -- System admin
  IF is_system_admin(auth.uid()) THEN
    RETURN true;
  END IF;
  
  -- Check if target user is a subordinate (any level) of current user
  IF EXISTS (
    SELECT 1 FROM public.get_all_subordinates(auth.uid()) 
    WHERE subordinate_user_id = _target_user_id
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Additional security protections for profiles and employees tables

-- 1. Add function to check if user can view another user's profile (with rate limiting concept)
CREATE OR REPLACE FUNCTION public.can_view_profile(_target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log the access attempt
  INSERT INTO public.sensitive_data_access_log (user_id, table_name, record_id, action)
  VALUES (auth.uid(), 'profiles', _target_user_id, 'view_profile_attempt');
  
  -- Only allow users to view their own profile or if they're admin
  RETURN (auth.uid() = _target_user_id) OR has_role(auth.uid(), 'admin'::app_role);
END;
$$;

-- 2. Add function to check if user can view employee data
CREATE OR REPLACE FUNCTION public.can_view_employee(_target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log the access attempt
  INSERT INTO public.sensitive_data_access_log (user_id, table_name, record_id, action)
  VALUES (auth.uid(), 'employees', _target_user_id, 'view_employee_attempt');
  
  -- Only allow users to view their own employee record or if they're admin
  RETURN (auth.uid() = _target_user_id) OR has_role(auth.uid(), 'admin'::app_role);
END;
$$;

-- 3. Update profiles policies to use the logging function
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile with logging"
ON public.profiles
FOR SELECT
USING (public.can_view_profile(id));

-- 4. Update employees policies to use the logging function
DROP POLICY IF EXISTS "Users can view their own employee record" ON public.employees;

CREATE POLICY "Users can view their own employee record with logging"
ON public.employees
FOR SELECT
USING (public.can_view_employee(user_id));

-- 5. Create index on access log for monitoring
CREATE INDEX IF NOT EXISTS idx_access_log_user_time 
ON public.sensitive_data_access_log(user_id, accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_access_log_table_action 
ON public.sensitive_data_access_log(table_name, action, accessed_at DESC);

-- 6. Add view for admins to monitor suspicious access patterns
CREATE OR REPLACE VIEW public.suspicious_access_attempts AS
SELECT 
  user_id,
  table_name,
  action,
  COUNT(*) as attempt_count,
  MIN(accessed_at) as first_attempt,
  MAX(accessed_at) as last_attempt
FROM public.sensitive_data_access_log
WHERE accessed_at > NOW() - INTERVAL '1 hour'
  AND action LIKE '%_attempt'
GROUP BY user_id, table_name, action
HAVING COUNT(*) > 10
ORDER BY attempt_count DESC;

-- Grant access to admins only
REVOKE ALL ON public.suspicious_access_attempts FROM PUBLIC;
GRANT SELECT ON public.suspicious_access_attempts TO authenticated;
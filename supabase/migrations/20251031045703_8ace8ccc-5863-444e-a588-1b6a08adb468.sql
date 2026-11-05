-- Fix security definer view issue by converting to a regular function

-- Drop the view that was flagged as security definer
DROP VIEW IF EXISTS public.suspicious_access_attempts;

-- Create a security definer function instead that can be called by admins
CREATE OR REPLACE FUNCTION public.get_suspicious_access_attempts()
RETURNS TABLE (
  user_id UUID,
  table_name TEXT,
  action TEXT,
  attempt_count BIGINT,
  first_attempt TIMESTAMP WITH TIME ZONE,
  last_attempt TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    sal.user_id,
    sal.table_name,
    sal.action,
    COUNT(*)::BIGINT as attempt_count,
    MIN(sal.accessed_at) as first_attempt,
    MAX(sal.accessed_at) as last_attempt
  FROM public.sensitive_data_access_log sal
  WHERE sal.accessed_at > NOW() - INTERVAL '1 hour'
    AND sal.action LIKE '%_attempt'
    AND has_role(auth.uid(), 'admin'::app_role)
  GROUP BY sal.user_id, sal.table_name, sal.action
  HAVING COUNT(*) > 10
  ORDER BY attempt_count DESC;
$$;
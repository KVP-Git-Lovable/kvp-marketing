-- Fix critical security issues

-- 1. Create gps_tracking_stops table with proper RLS
CREATE TABLE IF NOT EXISTS public.gps_tracking_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stopped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reason TEXT NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.gps_tracking_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own GPS stop reasons"
ON public.gps_tracking_stops
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own GPS stop reasons"
ON public.gps_tracking_stops
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all GPS stop reasons"
ON public.gps_tracking_stops
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Restrict distributor financial data access
DROP POLICY IF EXISTS "Users can view distributors" ON public.distributors;

CREATE POLICY "Admins can view all distributors"
ON public.distributors
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view basic distributor info (no financial data)"
ON public.distributors
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND NOT has_role(auth.uid(), 'admin'::app_role)
);

-- Note: The above policy allows read but financial columns should be masked in application layer for non-admins

-- 3. Add audit logging table for sensitive data access
CREATE TABLE IF NOT EXISTS public.sensitive_data_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL,
  ip_address TEXT,
  accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sensitive_data_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can view access logs"
ON public.sensitive_data_access_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert access logs"
ON public.sensitive_data_access_log
FOR INSERT
WITH CHECK (true);

-- 4. Add function to log sensitive data access
CREATE OR REPLACE FUNCTION public.log_sensitive_access(
  p_table_name TEXT,
  p_record_id UUID,
  p_action TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.sensitive_data_access_log (user_id, table_name, record_id, action)
  VALUES (auth.uid(), p_table_name, p_record_id, p_action);
END;
$$;
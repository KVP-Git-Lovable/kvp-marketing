-- Create table for tracking stop reasons
CREATE TABLE IF NOT EXISTS public.gps_tracking_stops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  stopped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reason TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gps_tracking_stops ENABLE ROW LEVEL SECURITY;

-- Users can insert their own stop reasons
CREATE POLICY "Users can insert their own stop reasons"
ON public.gps_tracking_stops
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own stop reasons
CREATE POLICY "Users can view their own stop reasons"
ON public.gps_tracking_stops
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all stop reasons
CREATE POLICY "Admins can view all stop reasons"
ON public.gps_tracking_stops
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);
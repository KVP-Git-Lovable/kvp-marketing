-- Create table for GPS tracking data
CREATE TABLE IF NOT EXISTS public.gps_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(10, 2),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  speed DECIMAL(10, 2),
  heading DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_gps_tracking_user_date ON public.gps_tracking(user_id, date);
CREATE INDEX IF NOT EXISTS idx_gps_tracking_timestamp ON public.gps_tracking(timestamp);

-- Enable RLS
ALTER TABLE public.gps_tracking ENABLE ROW LEVEL SECURITY;

-- Users can view their own tracking data
CREATE POLICY "Users can view their own GPS tracking"
ON public.gps_tracking
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own tracking data
CREATE POLICY "Users can insert their own GPS tracking"
ON public.gps_tracking
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all tracking data
CREATE POLICY "Admins can view all GPS tracking"
ON public.gps_tracking
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Add realtime support
ALTER PUBLICATION supabase_realtime ADD TABLE public.gps_tracking;
-- Create daily_gps_distance table for caching GPS-based travel distances
CREATE TABLE public.daily_gps_distance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_km NUMERIC NOT NULL DEFAULT 0,
  point_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.daily_gps_distance ENABLE ROW LEVEL SECURITY;

-- Users can view their own distance records
CREATE POLICY "Users can view own GPS distance"
  ON public.daily_gps_distance
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert/update their own distance records
CREATE POLICY "Users can upsert own GPS distance"
  ON public.daily_gps_distance
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own GPS distance"
  ON public.daily_gps_distance
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Managers can view subordinate distances
CREATE POLICY "Managers can view subordinate GPS distance"
  ON public.daily_gps_distance
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE employees.user_id = daily_gps_distance.user_id
      AND employees.manager_id = auth.uid()
    )
  );

-- Create index for efficient queries
CREATE INDEX idx_daily_gps_distance_user_date ON public.daily_gps_distance(user_id, date);
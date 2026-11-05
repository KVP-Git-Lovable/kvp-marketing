
CREATE TABLE public.device_battery_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  battery_level INTEGER NOT NULL,
  is_charging BOOLEAN NOT NULL DEFAULT false,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.device_battery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own battery logs"
  ON public.device_battery_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own battery logs"
  ON public.device_battery_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX idx_device_battery_logs_user_id ON public.device_battery_logs(user_id);
CREATE INDEX idx_device_battery_logs_recorded_at ON public.device_battery_logs(recorded_at DESC);

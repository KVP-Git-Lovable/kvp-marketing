
-- Create activity_events table
CREATE TABLE public.activity_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visit_id UUID REFERENCES public.visits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  activity_type TEXT NOT NULL DEFAULT 'Other',
  duration_type TEXT NOT NULL DEFAULT 'full_day',
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  half_day_type TEXT,
  from_date DATE,
  to_date DATE,
  total_days INTEGER,
  retailer_id UUID REFERENCES public.retailers(id),
  retailer_name TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own activity events
CREATE POLICY "Users can view own activity events"
  ON public.activity_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all activity events
CREATE POLICY "Admins can view all activity events"
  ON public.activity_events
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Users can insert their own activity events
CREATE POLICY "Users can insert own activity events"
  ON public.activity_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own activity events
CREATE POLICY "Users can update own activity events"
  ON public.activity_events
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own activity events
CREATE POLICY "Users can delete own activity events"
  ON public.activity_events
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for efficient lookups
CREATE INDEX idx_activity_events_visit_id ON public.activity_events(visit_id);
CREATE INDEX idx_activity_events_user_id ON public.activity_events(user_id);
CREATE INDEX idx_activity_events_activity_date ON public.activity_events(activity_date);

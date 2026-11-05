-- Create retailer visit logs table for automatic time and location tracking
CREATE TABLE IF NOT EXISTS public.retailer_visit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  retailer_id UUID NOT NULL,
  visit_id UUID REFERENCES public.visits(id),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  time_spent_seconds INTEGER,
  start_latitude NUMERIC,
  start_longitude NUMERIC,
  distance_meters NUMERIC,
  location_status TEXT CHECK (location_status IN ('at_store', 'within_range', 'not_at_store', 'location_unavailable')),
  action_type TEXT CHECK (action_type IN ('order', 'feedback', 'ai', 'phone_order')),
  is_phone_order BOOLEAN DEFAULT FALSE,
  visit_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_retailer_visit_logs_user_date ON public.retailer_visit_logs(user_id, visit_date);
CREATE INDEX idx_retailer_visit_logs_retailer ON public.retailer_visit_logs(retailer_id);
CREATE INDEX idx_retailer_visit_logs_visit ON public.retailer_visit_logs(visit_id);

-- Enable RLS
ALTER TABLE public.retailer_visit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own visit logs"
  ON public.retailer_visit_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own visit logs"
  ON public.retailer_visit_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own visit logs"
  ON public.retailer_visit_logs
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can view all logs
CREATE POLICY "Admins can view all visit logs"
  ON public.retailer_visit_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_retailer_visit_logs_updated_at
  BEFORE UPDATE ON public.retailer_visit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
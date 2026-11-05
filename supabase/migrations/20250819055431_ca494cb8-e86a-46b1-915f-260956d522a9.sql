-- Create beat_allowances table for managing daily and travel allowances by beat
CREATE TABLE public.beat_allowances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  beat_id TEXT NOT NULL,
  beat_name TEXT NOT NULL,
  user_id UUID NOT NULL,
  daily_allowance NUMERIC NOT NULL DEFAULT 0,
  travel_allowance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(beat_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.beat_allowances ENABLE ROW LEVEL SECURITY;

-- Create policies for beat allowances
CREATE POLICY "Admins can manage beat allowances" 
ON public.beat_allowances 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own beat allowances" 
ON public.beat_allowances 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_beat_allowances_updated_at
BEFORE UPDATE ON public.beat_allowances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
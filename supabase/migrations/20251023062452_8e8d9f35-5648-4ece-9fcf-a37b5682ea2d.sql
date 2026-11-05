-- Create a shared beats table that all users can access
CREATE TABLE IF NOT EXISTS public.beats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  beat_id text NOT NULL UNIQUE,
  beat_name text NOT NULL,
  category text DEFAULT 'General',
  travel_allowance numeric DEFAULT 0,
  average_km numeric DEFAULT 0,
  average_time_minutes integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.beats ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view beats
CREATE POLICY "Authenticated users can view all beats"
ON public.beats
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Policy: Authenticated users can create beats
CREATE POLICY "Authenticated users can create beats"
ON public.beats
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Users can update beats they created OR admins can update any
CREATE POLICY "Users can update beats"
ON public.beats
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Policy: Users can delete beats they created OR admins can delete any
CREATE POLICY "Users can delete beats"
ON public.beats
FOR DELETE
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_beats_beat_id ON public.beats(beat_id);
CREATE INDEX IF NOT EXISTS idx_beats_created_by ON public.beats(created_by);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_beats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_beats_updated_at
BEFORE UPDATE ON public.beats
FOR EACH ROW
EXECUTE FUNCTION public.update_beats_updated_at();

-- Migrate existing beats from retailers and beat_allowances tables
-- Only insert beats where the user exists in auth.users
INSERT INTO public.beats (beat_id, beat_name, category, travel_allowance, average_km, average_time_minutes, created_by)
SELECT DISTINCT ON (r.beat_id)
  r.beat_id,
  COALESCE(bp.beat_name, r.beat_name, r.beat_id) as beat_name,
  COALESCE(r.category, 'General') as category,
  COALESCE(ba.travel_allowance, 0) as travel_allowance,
  COALESCE(ba.average_km, 0) as average_km,
  COALESCE(ba.average_time_minutes, 0) as average_time_minutes,
  CASE 
    WHEN EXISTS (SELECT 1 FROM auth.users WHERE id = r.user_id) THEN r.user_id
    ELSE NULL
  END as created_by
FROM public.retailers r
LEFT JOIN public.beat_plans bp ON bp.beat_id = r.beat_id AND bp.user_id = r.user_id
LEFT JOIN public.beat_allowances ba ON ba.beat_id = r.beat_id AND ba.user_id = r.user_id
WHERE r.beat_id IS NOT NULL 
  AND r.beat_id != '' 
  AND r.beat_id != 'unassigned'
ON CONFLICT (beat_id) DO NOTHING;
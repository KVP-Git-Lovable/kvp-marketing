-- Create distributor_beat_mappings table for many-to-many relationship
CREATE TABLE IF NOT EXISTS public.distributor_beat_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  distributor_id UUID NOT NULL REFERENCES public.distributors(id) ON DELETE CASCADE,
  beat_id UUID NOT NULL REFERENCES public.beats(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(distributor_id, beat_id)
);

-- Enable RLS
ALTER TABLE public.distributor_beat_mappings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage distributor beat mappings"
ON public.distributor_beat_mappings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view distributor beat mappings"
ON public.distributor_beat_mappings
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create distributor beat mappings"
ON public.distributor_beat_mappings
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Create index for performance
CREATE INDEX idx_distributor_beat_mappings_distributor ON public.distributor_beat_mappings(distributor_id);
CREATE INDEX idx_distributor_beat_mappings_beat ON public.distributor_beat_mappings(beat_id);
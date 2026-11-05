-- Create user_business_plan_territories table for territory-level targets
CREATE TABLE public.user_business_plan_territories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_plan_id UUID NOT NULL REFERENCES public.user_business_plans(id) ON DELETE CASCADE,
  territory_id UUID NOT NULL REFERENCES public.territories(id) ON DELETE CASCADE,
  territory_name TEXT NOT NULL,
  quantity_target NUMERIC DEFAULT 0,
  revenue_target NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(business_plan_id, territory_id)
);

-- Create user_business_plan_territory_beats table for beat-level targets under territories
CREATE TABLE public.user_business_plan_territory_beats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_plan_id UUID NOT NULL REFERENCES public.user_business_plans(id) ON DELETE CASCADE,
  territory_id UUID NOT NULL REFERENCES public.territories(id) ON DELETE CASCADE,
  beat_id UUID NOT NULL REFERENCES public.beats(id) ON DELETE CASCADE,
  beat_name TEXT NOT NULL,
  percentage NUMERIC DEFAULT 0,
  quantity_target NUMERIC DEFAULT 0,
  revenue_target NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(business_plan_id, territory_id, beat_id)
);

-- Enable RLS on both tables
ALTER TABLE public.user_business_plan_territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_business_plan_territory_beats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_business_plan_territories
CREATE POLICY "Users can view their own territory targets"
  ON public.user_business_plan_territories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_business_plans ubp
      WHERE ubp.id = business_plan_id AND ubp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own territory targets"
  ON public.user_business_plan_territories
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_business_plans ubp
      WHERE ubp.id = business_plan_id AND ubp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own territory targets"
  ON public.user_business_plan_territories
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_business_plans ubp
      WHERE ubp.id = business_plan_id AND ubp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own territory targets"
  ON public.user_business_plan_territories
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_business_plans ubp
      WHERE ubp.id = business_plan_id AND ubp.user_id = auth.uid()
    )
  );

-- RLS Policies for user_business_plan_territory_beats
CREATE POLICY "Users can view their own territory beat targets"
  ON public.user_business_plan_territory_beats
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_business_plans ubp
      WHERE ubp.id = business_plan_id AND ubp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own territory beat targets"
  ON public.user_business_plan_territory_beats
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_business_plans ubp
      WHERE ubp.id = business_plan_id AND ubp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own territory beat targets"
  ON public.user_business_plan_territory_beats
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_business_plans ubp
      WHERE ubp.id = business_plan_id AND ubp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own territory beat targets"
  ON public.user_business_plan_territory_beats
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_business_plans ubp
      WHERE ubp.id = business_plan_id AND ubp.user_id = auth.uid()
    )
  );

-- Add trigger for updated_at on territories table
CREATE TRIGGER update_user_business_plan_territories_updated_at
  BEFORE UPDATE ON public.user_business_plan_territories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
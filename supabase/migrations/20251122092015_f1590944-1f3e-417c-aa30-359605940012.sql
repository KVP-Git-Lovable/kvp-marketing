-- Create retailer loyalty programs table
CREATE TABLE IF NOT EXISTS public.retailer_loyalty_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  territories TEXT[] DEFAULT '{}',
  is_all_territories BOOLEAN DEFAULT false,
  points_to_rupee_conversion NUMERIC NOT NULL DEFAULT 10.0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create retailer loyalty actions table
CREATE TABLE IF NOT EXISTS public.retailer_loyalty_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.retailer_loyalty_programs(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_name TEXT NOT NULL,
  points NUMERIC NOT NULL DEFAULT 0,
  is_enabled BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create retailer loyalty points table
CREATE TABLE IF NOT EXISTS public.retailer_loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.retailer_loyalty_programs(id) ON DELETE CASCADE,
  retailer_id UUID NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  action_id UUID NOT NULL REFERENCES public.retailer_loyalty_actions(id) ON DELETE CASCADE,
  points NUMERIC NOT NULL DEFAULT 0,
  reference_type TEXT,
  reference_id UUID,
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  awarded_by_user_id UUID,
  metadata JSONB DEFAULT '{}'
);

-- Create retailer loyalty redemptions table
CREATE TABLE IF NOT EXISTS public.retailer_loyalty_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.retailer_loyalty_programs(id) ON DELETE CASCADE,
  points_redeemed NUMERIC NOT NULL DEFAULT 0,
  voucher_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES public.profiles(id),
  voucher_code TEXT,
  rejection_reason TEXT,
  requested_by_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create retailer loyalty tracking table
CREATE TABLE IF NOT EXISTS public.retailer_loyalty_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE UNIQUE,
  last_order_date DATE,
  consecutive_order_count INTEGER DEFAULT 0,
  total_orders_count INTEGER DEFAULT 0,
  last_points_earned_date DATE,
  new_products_tried TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_retailer_loyalty_points_retailer ON public.retailer_loyalty_points(retailer_id, earned_at DESC);
CREATE INDEX IF NOT EXISTS idx_retailer_loyalty_points_program ON public.retailer_loyalty_points(program_id);
CREATE INDEX IF NOT EXISTS idx_retailer_loyalty_redemptions_retailer ON public.retailer_loyalty_redemptions(retailer_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_retailer_loyalty_redemptions_status ON public.retailer_loyalty_redemptions(status);
CREATE INDEX IF NOT EXISTS idx_retailer_loyalty_tracking_retailer ON public.retailer_loyalty_tracking(retailer_id);

-- Enable RLS
ALTER TABLE public.retailer_loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_loyalty_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_loyalty_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_loyalty_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for retailer_loyalty_programs
CREATE POLICY "Admins can manage loyalty programs"
  ON public.retailer_loyalty_programs
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "FSEs can view active programs"
  ON public.retailer_loyalty_programs
  FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

-- RLS Policies for retailer_loyalty_actions
CREATE POLICY "Admins can manage loyalty actions"
  ON public.retailer_loyalty_actions
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "FSEs can view enabled actions"
  ON public.retailer_loyalty_actions
  FOR SELECT
  USING (is_enabled = true AND auth.uid() IS NOT NULL);

-- RLS Policies for retailer_loyalty_points
CREATE POLICY "Admins can manage all loyalty points"
  ON public.retailer_loyalty_points
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "FSEs can view points for their retailers"
  ON public.retailer_loyalty_points
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.retailers r
      WHERE r.id = retailer_loyalty_points.retailer_id
      AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert loyalty points"
  ON public.retailer_loyalty_points
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for retailer_loyalty_redemptions
CREATE POLICY "Admins can manage all redemptions"
  ON public.retailer_loyalty_redemptions
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "FSEs can view and create redemptions for their retailers"
  ON public.retailer_loyalty_redemptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.retailers r
      WHERE r.id = retailer_loyalty_redemptions.retailer_id
      AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "FSEs can create redemptions for their retailers"
  ON public.retailer_loyalty_redemptions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.retailers r
      WHERE r.id = retailer_loyalty_redemptions.retailer_id
      AND r.user_id = auth.uid()
    )
  );

-- RLS Policies for retailer_loyalty_tracking
CREATE POLICY "Admins can manage all tracking"
  ON public.retailer_loyalty_tracking
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "FSEs can view tracking for their retailers"
  ON public.retailer_loyalty_tracking
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.retailers r
      WHERE r.id = retailer_loyalty_tracking.retailer_id
      AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "System can update tracking"
  ON public.retailer_loyalty_tracking
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "System can update tracking records"
  ON public.retailer_loyalty_tracking
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at columns
CREATE OR REPLACE FUNCTION public.update_retailer_loyalty_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_retailer_loyalty_programs_updated_at
  BEFORE UPDATE ON public.retailer_loyalty_programs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_retailer_loyalty_updated_at();

CREATE TRIGGER update_retailer_loyalty_actions_updated_at
  BEFORE UPDATE ON public.retailer_loyalty_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_retailer_loyalty_updated_at();

CREATE TRIGGER update_retailer_loyalty_redemptions_updated_at
  BEFORE UPDATE ON public.retailer_loyalty_redemptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_retailer_loyalty_updated_at();

CREATE TRIGGER update_retailer_loyalty_tracking_updated_at
  BEFORE UPDATE ON public.retailer_loyalty_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_retailer_loyalty_updated_at();
-- =====================================================
-- RETAILER LOYALTY 2.0 - Complete Rebuild
-- =====================================================

-- 1. Create new loyalty_plans table (replaces retailer_loyalty_programs)
CREATE TABLE public.retailer_loyalty_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  points_to_rupee_conversion NUMERIC DEFAULT 10, -- 10 points = ₹1
  territories UUID[] DEFAULT '{}',
  is_all_territories BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create loyalty_parameters table (earning rules - like gamification_actions)
CREATE TABLE public.retailer_loyalty_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES public.retailer_loyalty_plans(id) ON DELETE CASCADE,
  parameter_type TEXT NOT NULL, -- order_value, order_frequency, focused_product, monthly_growth, annual_volume, bulk_order, first_order, consecutive_orders, timely_payment, category_champion, new_product_trial, referral_bonus
  parameter_name TEXT NOT NULL,
  description TEXT,
  points INTEGER NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  -- Configuration fields
  min_value NUMERIC,                   -- For order value thresholds
  max_value NUMERIC,                   -- For order value caps
  frequency_days INTEGER,              -- For order frequency
  consecutive_required INTEGER,        -- For streak bonuses
  growth_percentage NUMERIC,           -- For month-on-month growth
  target_value NUMERIC,                -- For annual/monthly targets
  focused_products UUID[],             -- For focused product sales
  focused_categories TEXT[],           -- For category-based rewards
  max_awards_per_period INTEGER,       -- Limit awards per day/week/month
  award_period TEXT,                   -- 'daily', 'weekly', 'monthly', 'yearly', 'once'
  tier_config JSONB DEFAULT '{}',      -- For tiered point structures
  qualifying_criteria TEXT,            -- Human readable criteria
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create loyalty_gifts table (Gift Master)
CREATE TABLE public.retailer_loyalty_gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES public.retailer_loyalty_plans(id) ON DELETE SET NULL,
  gift_name TEXT NOT NULL,
  description TEXT,
  gift_type TEXT NOT NULL, -- 'physical', 'voucher', 'experience', 'cash', 'product'
  points_required INTEGER NOT NULL,
  cash_equivalent NUMERIC, -- Optional cash value
  image_url TEXT,
  stock_quantity INTEGER DEFAULT 0,
  is_limited_stock BOOLEAN DEFAULT false,
  -- Goal/Target configuration
  target_description TEXT, -- "Achieve 50,000 points in 6 months"
  target_duration_months INTEGER,
  minimum_monthly_orders INTEGER,
  minimum_order_value NUMERIC,
  eligibility_criteria JSONB DEFAULT '{}', -- Additional rules
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create gift_subscriptions table (Retailer's gift goals)
CREATE TABLE public.retailer_gift_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID NOT NULL,
  gift_id UUID REFERENCES public.retailer_loyalty_gifts(id) ON DELETE CASCADE,
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  target_date DATE,
  status TEXT DEFAULT 'active', -- 'active', 'achieved', 'cancelled', 'expired', 'redeemed'
  progress_points INTEGER DEFAULT 0,
  points_at_subscription INTEGER DEFAULT 0, -- Snapshot at subscription time
  achieved_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create gift_redemptions table (Redemption tracking)
CREATE TABLE public.retailer_gift_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID NOT NULL,
  gift_id UUID REFERENCES public.retailer_loyalty_gifts(id),
  subscription_id UUID REFERENCES public.retailer_gift_subscriptions(id),
  points_redeemed INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'fulfilled'
  requested_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by UUID,
  fulfillment_notes TEXT,
  delivery_address TEXT,
  voucher_code TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Add new columns to existing retailer_loyalty_points table
ALTER TABLE public.retailer_loyalty_points 
  ADD COLUMN IF NOT EXISTS parameter_id UUID REFERENCES public.retailer_loyalty_parameters(id),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS visit_id UUID;

-- 7. Create retailer_loyalty_balance view for quick balance lookup
CREATE OR REPLACE VIEW public.retailer_loyalty_balance AS
SELECT 
  retailer_id,
  COALESCE(SUM(points), 0) as total_points,
  COUNT(*) as total_transactions
FROM public.retailer_loyalty_points
GROUP BY retailer_id;

-- Enable RLS on all new tables
ALTER TABLE public.retailer_loyalty_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_loyalty_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_loyalty_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_gift_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retailer_gift_redemptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for retailer_loyalty_plans
CREATE POLICY "Admins can manage loyalty plans" ON public.retailer_loyalty_plans
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view active plans" ON public.retailer_loyalty_plans
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- RLS Policies for retailer_loyalty_parameters  
CREATE POLICY "Admins can manage loyalty parameters" ON public.retailer_loyalty_parameters
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view parameters" ON public.retailer_loyalty_parameters
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- RLS Policies for retailer_loyalty_gifts
CREATE POLICY "Admins can manage loyalty gifts" ON public.retailer_loyalty_gifts
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view active gifts" ON public.retailer_loyalty_gifts
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- RLS Policies for retailer_gift_subscriptions
CREATE POLICY "Admins can manage all subscriptions" ON public.retailer_gift_subscriptions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view subscriptions" ON public.retailer_gift_subscriptions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert subscriptions" ON public.retailer_gift_subscriptions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update subscriptions" ON public.retailer_gift_subscriptions
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- RLS Policies for retailer_gift_redemptions
CREATE POLICY "Admins can manage all redemptions" ON public.retailer_gift_redemptions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view redemptions" ON public.retailer_gift_redemptions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can request redemptions" ON public.retailer_gift_redemptions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_loyalty_parameters_plan_id ON public.retailer_loyalty_parameters(plan_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_parameters_type ON public.retailer_loyalty_parameters(parameter_type);
CREATE INDEX IF NOT EXISTS idx_loyalty_gifts_plan_id ON public.retailer_loyalty_gifts(plan_id);
CREATE INDEX IF NOT EXISTS idx_gift_subscriptions_retailer ON public.retailer_gift_subscriptions(retailer_id);
CREATE INDEX IF NOT EXISTS idx_gift_subscriptions_status ON public.retailer_gift_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_gift_redemptions_retailer ON public.retailer_gift_redemptions(retailer_id);
CREATE INDEX IF NOT EXISTS idx_gift_redemptions_status ON public.retailer_gift_redemptions(status);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_parameter ON public.retailer_loyalty_points(parameter_id);

-- Update triggers for updated_at
CREATE TRIGGER update_retailer_loyalty_plans_updated_at
  BEFORE UPDATE ON public.retailer_loyalty_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_retailer_loyalty_parameters_updated_at
  BEFORE UPDATE ON public.retailer_loyalty_parameters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_retailer_loyalty_gifts_updated_at
  BEFORE UPDATE ON public.retailer_loyalty_gifts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_retailer_gift_subscriptions_updated_at
  BEFORE UPDATE ON public.retailer_gift_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_retailer_gift_redemptions_updated_at
  BEFORE UPDATE ON public.retailer_gift_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
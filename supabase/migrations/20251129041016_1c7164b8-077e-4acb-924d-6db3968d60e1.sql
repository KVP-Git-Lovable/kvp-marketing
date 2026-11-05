-- Target vs. Actual Performance Module Migration

-- 1. Module Configuration Table
CREATE TABLE IF NOT EXISTS public.performance_module_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  active_module TEXT NOT NULL DEFAULT 'none' CHECK (active_module IN ('gamification', 'target_actual', 'none')),
  rating_thresholds JSONB DEFAULT '{"excellent": 100, "good": 80, "average": 60, "needs_improvement": 0}'::jsonb,
  enabled_periods TEXT[] DEFAULT ARRAY['month', 'quarter', 'year']::TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.performance_module_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage module config" ON public.performance_module_config
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view module config" ON public.performance_module_config
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Insert default config
INSERT INTO public.performance_module_config (active_module) VALUES ('none')
ON CONFLICT DO NOTHING;

-- 2. KPI Definitions Table
CREATE TABLE IF NOT EXISTS public.target_kpi_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_key TEXT UNIQUE NOT NULL,
  kpi_name TEXT NOT NULL,
  description TEXT,
  data_source TEXT NOT NULL,
  calculation_method TEXT NOT NULL,
  unit TEXT DEFAULT 'number',
  weightage NUMERIC DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.target_kpi_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage KPI definitions" ON public.target_kpi_definitions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view active KPIs" ON public.target_kpi_definitions
  FOR SELECT USING (is_active = true AND auth.uid() IS NOT NULL);

-- Pre-seed KPIs
INSERT INTO public.target_kpi_definitions (kpi_key, kpi_name, description, data_source, calculation_method, unit, weightage, display_order) VALUES
('revenue_contribution', 'Revenue Contribution', 'Total order value from confirmed orders', 'orders', 'sum', 'currency', 15, 1),
('new_retailer_addition', 'New Retailer Addition', 'Number of new retailers added', 'retailers', 'count', 'number', 10, 2),
('focused_product_sales', 'Focused Product Sales', 'Revenue from focused/priority products', 'order_items', 'sum', 'currency', 15, 3),
('productive_visits', 'Productive Visits', 'Visits that resulted in orders', 'visits', 'count', 'number', 10, 4),
('beat_adherence', 'Beat Adherence', 'Planned visits vs actual visits percentage', 'beat_plans', 'percentage', 'percentage', 15, 5),
('visit_completion_rate', 'Visit Completion Rate', 'Percentage of planned visits completed', 'visits', 'percentage', 'percentage', 10, 6),
('beat_growth_rate', 'Beat Growth Rate', 'Revenue growth in assigned beats', 'orders', 'growth_rate', 'percentage', 10, 7),
('retailer_revenue_growth', 'Retailer Revenue Growth', 'Average revenue growth per retailer', 'orders', 'growth_rate', 'percentage', 10, 8),
('system_adherence', 'Planning & System Adherence', 'Beat planning consistency score', 'beat_plans', 'percentage', 'percentage', 5, 9)
ON CONFLICT (kpi_key) DO NOTHING;

-- 3. Role Targets Table
CREATE TABLE IF NOT EXISTS public.role_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID REFERENCES public.target_kpi_definitions(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  territory_id UUID REFERENCES public.territories(id),
  monthly_target NUMERIC NOT NULL DEFAULT 0,
  quarterly_target NUMERIC NOT NULL DEFAULT 0,
  yearly_target NUMERIC NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.role_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage role targets" ON public.role_targets
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view role targets" ON public.role_targets
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 4. User Period Targets Table
CREATE TABLE IF NOT EXISTS public.user_period_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kpi_id UUID REFERENCES public.target_kpi_definitions(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('month', 'quarter', 'year')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  target_value NUMERIC NOT NULL DEFAULT 0,
  actual_value NUMERIC DEFAULT 0,
  achievement_percent NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'in_progress',
  last_calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, kpi_id, period_type, period_start)
);

ALTER TABLE public.user_period_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all user targets" ON public.user_period_targets
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own targets" ON public.user_period_targets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Managers can view subordinate targets" ON public.user_period_targets
  FOR SELECT USING (
    user_id IN (SELECT subordinate_user_id FROM get_subordinate_users(auth.uid()))
  );

CREATE POLICY "System can manage user targets" ON public.user_period_targets
  FOR ALL USING (auth.uid() IS NOT NULL);

-- 5. User Performance Scores Table
CREATE TABLE IF NOT EXISTS public.user_performance_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  period_type TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  weighted_average_score NUMERIC DEFAULT 0,
  performance_rating TEXT DEFAULT 'needs_improvement',
  kpi_scores JSONB DEFAULT '{}'::jsonb,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, period_type, period_start)
);

ALTER TABLE public.user_performance_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all performance scores" ON public.user_performance_scores
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own scores" ON public.user_performance_scores
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Managers can view subordinate scores" ON public.user_performance_scores
  FOR SELECT USING (
    user_id IN (SELECT subordinate_user_id FROM get_subordinate_users(auth.uid()))
  );

CREATE POLICY "System can manage performance scores" ON public.user_performance_scores
  FOR ALL USING (auth.uid() IS NOT NULL);

-- 6. Target Actual Logs Table
CREATE TABLE IF NOT EXISTS public.target_actual_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kpi_id UUID REFERENCES public.target_kpi_definitions(id),
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  daily_actual NUMERIC DEFAULT 0,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.target_actual_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage logs" ON public.target_actual_logs
  FOR ALL USING (auth.uid() IS NOT NULL);

-- PostgreSQL Functions for KPI Calculations

-- Calculate Revenue Contribution
CREATE OR REPLACE FUNCTION public.calculate_revenue_contribution(p_user_id UUID, p_start DATE, p_end DATE)
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(total_amount), 0)
  FROM public.orders
  WHERE user_id = p_user_id
    AND status IN ('confirmed', 'delivered')
    AND order_date BETWEEN p_start AND p_end;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Calculate New Retailers
CREATE OR REPLACE FUNCTION public.calculate_new_retailers(p_user_id UUID, p_start DATE, p_end DATE)
RETURNS NUMERIC AS $$
  SELECT COUNT(*)::NUMERIC
  FROM public.retailers
  WHERE user_id = p_user_id
    AND created_at::DATE BETWEEN p_start AND p_end;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Calculate Productive Visits
CREATE OR REPLACE FUNCTION public.calculate_productive_visits(p_user_id UUID, p_start DATE, p_end DATE)
RETURNS NUMERIC AS $$
  SELECT COUNT(DISTINCT v.id)::NUMERIC
  FROM public.visits v
  WHERE v.user_id = p_user_id
    AND v.planned_date BETWEEN p_start AND p_end
    AND v.status = 'productive';
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Calculate Beat Adherence
CREATE OR REPLACE FUNCTION public.calculate_beat_adherence(p_user_id UUID, p_start DATE, p_end DATE)
RETURNS NUMERIC AS $$
DECLARE
  planned_count INTEGER;
  actual_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO planned_count
  FROM public.beat_plans bp
  WHERE bp.user_id = p_user_id AND bp.plan_date BETWEEN p_start AND p_end;
  
  SELECT COUNT(DISTINCT v.id) INTO actual_count
  FROM public.visits v
  JOIN public.beat_plans bp ON v.beat_id = bp.beat_id AND v.planned_date = bp.plan_date
  WHERE v.user_id = p_user_id AND v.planned_date BETWEEN p_start AND p_end
    AND v.status IN ('productive', 'unproductive');
  
  IF planned_count = 0 THEN RETURN 0; END IF;
  RETURN ROUND((actual_count::NUMERIC / planned_count::NUMERIC) * 100, 2);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Calculate Visit Completion Rate
CREATE OR REPLACE FUNCTION public.calculate_visit_completion_rate(p_user_id UUID, p_start DATE, p_end DATE)
RETURNS NUMERIC AS $$
DECLARE
  planned_count INTEGER;
  completed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO planned_count
  FROM public.visits
  WHERE user_id = p_user_id AND planned_date BETWEEN p_start AND p_end;
  
  SELECT COUNT(*) INTO completed_count
  FROM public.visits
  WHERE user_id = p_user_id 
    AND planned_date BETWEEN p_start AND p_end
    AND status IN ('productive', 'unproductive');
  
  IF planned_count = 0 THEN RETURN 0; END IF;
  RETURN ROUND((completed_count::NUMERIC / planned_count::NUMERIC) * 100, 2);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Master Calculation Function
CREATE OR REPLACE FUNCTION public.calculate_user_kpi_actual(
  p_user_id UUID, 
  p_kpi_key TEXT, 
  p_start DATE, 
  p_end DATE
) RETURNS NUMERIC AS $$
BEGIN
  CASE p_kpi_key
    WHEN 'revenue_contribution' THEN 
      RETURN calculate_revenue_contribution(p_user_id, p_start, p_end);
    WHEN 'new_retailer_addition' THEN 
      RETURN calculate_new_retailers(p_user_id, p_start, p_end);
    WHEN 'productive_visits' THEN 
      RETURN calculate_productive_visits(p_user_id, p_start, p_end);
    WHEN 'beat_adherence' THEN 
      RETURN calculate_beat_adherence(p_user_id, p_start, p_end);
    WHEN 'visit_completion_rate' THEN
      RETURN calculate_visit_completion_rate(p_user_id, p_start, p_end);
    ELSE 
      RETURN 0;
  END CASE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Triggers for Real-Time Updates

-- Trigger function to update revenue actuals
CREATE OR REPLACE FUNCTION public.update_revenue_actual()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('confirmed', 'delivered') THEN
    UPDATE public.user_period_targets upt
    SET 
      actual_value = public.calculate_revenue_contribution(NEW.user_id, upt.period_start, upt.period_end),
      achievement_percent = CASE 
        WHEN target_value > 0 THEN ROUND((actual_value / target_value) * 100, 2) 
        ELSE 0 
      END,
      last_calculated_at = now()
    WHERE upt.user_id = NEW.user_id
      AND upt.kpi_id = (SELECT id FROM public.target_kpi_definitions WHERE kpi_key = 'revenue_contribution')
      AND NEW.order_date BETWEEN upt.period_start AND upt.period_end;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_update_revenue_on_order
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.update_revenue_actual();

-- Trigger function to update new retailer actuals
CREATE OR REPLACE FUNCTION public.update_new_retailer_actual()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_period_targets upt
  SET 
    actual_value = public.calculate_new_retailers(NEW.user_id, upt.period_start, upt.period_end),
    achievement_percent = CASE 
      WHEN target_value > 0 THEN ROUND((actual_value / target_value) * 100, 2) 
      ELSE 0 
    END,
    last_calculated_at = now()
  WHERE upt.user_id = NEW.user_id
    AND upt.kpi_id = (SELECT id FROM public.target_kpi_definitions WHERE kpi_key = 'new_retailer_addition')
    AND NEW.created_at::DATE BETWEEN upt.period_start AND upt.period_end;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_update_retailer_count
AFTER INSERT ON public.retailers
FOR EACH ROW EXECUTE FUNCTION public.update_new_retailer_actual();

-- Trigger function to update visit-related actuals
CREATE OR REPLACE FUNCTION public.update_visit_actuals()
RETURNS TRIGGER AS $$
BEGIN
  -- Update productive visits
  UPDATE public.user_period_targets upt
  SET 
    actual_value = public.calculate_productive_visits(NEW.user_id, upt.period_start, upt.period_end),
    achievement_percent = CASE 
      WHEN target_value > 0 THEN ROUND((actual_value / target_value) * 100, 2) 
      ELSE 0 
    END,
    last_calculated_at = now()
  WHERE upt.user_id = NEW.user_id
    AND upt.kpi_id = (SELECT id FROM public.target_kpi_definitions WHERE kpi_key = 'productive_visits')
    AND NEW.planned_date BETWEEN upt.period_start AND upt.period_end;
  
  -- Update beat adherence
  UPDATE public.user_period_targets upt
  SET 
    actual_value = public.calculate_beat_adherence(NEW.user_id, upt.period_start, upt.period_end),
    achievement_percent = actual_value,
    last_calculated_at = now()
  WHERE upt.user_id = NEW.user_id
    AND upt.kpi_id = (SELECT id FROM public.target_kpi_definitions WHERE kpi_key = 'beat_adherence')
    AND NEW.planned_date BETWEEN upt.period_start AND upt.period_end;
  
  -- Update visit completion rate
  UPDATE public.user_period_targets upt
  SET 
    actual_value = public.calculate_visit_completion_rate(NEW.user_id, upt.period_start, upt.period_end),
    achievement_percent = actual_value,
    last_calculated_at = now()
  WHERE upt.user_id = NEW.user_id
    AND upt.kpi_id = (SELECT id FROM public.target_kpi_definitions WHERE kpi_key = 'visit_completion_rate')
    AND NEW.planned_date BETWEEN upt.period_start AND upt.period_end;
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_update_visit_actuals
AFTER INSERT OR UPDATE ON public.visits
FOR EACH ROW EXECUTE FUNCTION public.update_visit_actuals();
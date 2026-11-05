-- 1. Add period type to FY config
ALTER TABLE fy_target_config 
ADD COLUMN IF NOT EXISTS target_period_type TEXT DEFAULT 'annual';

-- 2. Create period targets table for FY-level period configuration
CREATE TABLE IF NOT EXISTS fy_period_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fy_config_id UUID REFERENCES fy_target_config(id) ON DELETE CASCADE NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('biannual', 'quarterly', 'monthly')),
  period_number INTEGER NOT NULL,
  period_name TEXT NOT NULL,
  quantity_target NUMERIC DEFAULT 0,
  revenue_target NUMERIC DEFAULT 0,
  visits_target INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(fy_config_id, period_type, period_number)
);

-- 3. Create user period allocations table for hierarchy cascade
CREATE TABLE IF NOT EXISTS user_period_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_plan_id UUID REFERENCES user_business_plans(id) ON DELETE CASCADE NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('biannual', 'quarterly', 'monthly')),
  period_number INTEGER NOT NULL,
  quantity_target NUMERIC DEFAULT 0,
  revenue_target NUMERIC DEFAULT 0,
  visits_target INTEGER DEFAULT 0,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'rollup', 'hierarchy')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_plan_id, period_type, period_number)
);

-- 4. Enable RLS
ALTER TABLE fy_period_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_period_allocations ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for fy_period_targets
CREATE POLICY "Admins can manage period targets"
ON fy_period_targets FOR ALL
USING (public.is_system_admin(auth.uid()));

CREATE POLICY "Authenticated users can view period targets"
ON fy_period_targets FOR SELECT
TO authenticated
USING (true);

-- 6. RLS Policies for user_period_allocations
CREATE POLICY "Users can view their period allocations"
ON user_period_allocations FOR SELECT
USING (
  business_plan_id IN (
    SELECT id FROM user_business_plans WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage all period allocations"
ON user_period_allocations FOR ALL
USING (public.is_system_admin(auth.uid()));

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_fy_period_targets_config ON fy_period_targets(fy_config_id);
CREATE INDEX IF NOT EXISTS idx_fy_period_targets_type ON fy_period_targets(period_type);
CREATE INDEX IF NOT EXISTS idx_user_period_allocations_plan ON user_period_allocations(business_plan_id);
CREATE INDEX IF NOT EXISTS idx_user_period_allocations_type ON user_period_allocations(period_type);

-- 8. Add updated_at trigger for fy_period_targets
CREATE TRIGGER update_fy_period_targets_updated_at
BEFORE UPDATE ON fy_period_targets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Add updated_at trigger for user_period_allocations
CREATE TRIGGER update_user_period_allocations_updated_at
BEFORE UPDATE ON user_period_allocations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
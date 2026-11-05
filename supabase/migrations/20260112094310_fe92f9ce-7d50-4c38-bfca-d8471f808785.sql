-- Leave Policy Master: Define entitlements per leave type
CREATE TABLE IF NOT EXISTS public.leave_policy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  yearly_entitlement INTEGER NOT NULL DEFAULT 12,
  monthly_accrual DECIMAL(5,2) DEFAULT NULL,
  accrual_type TEXT NOT NULL DEFAULT 'yearly' CHECK (accrual_type IN ('yearly', 'monthly', 'quarterly')),
  carry_forward_allowed BOOLEAN DEFAULT false,
  max_carry_forward INTEGER DEFAULT 0,
  applicable_from DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(leave_type_id)
);

-- Working Days Configuration per month
CREATE TABLE IF NOT EXISTS public.working_days_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  total_days INTEGER NOT NULL,
  working_days INTEGER NOT NULL,
  week_offs INTEGER NOT NULL DEFAULT 0,
  holidays INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(year, month)
);

-- Week-off Configuration (global settings)
CREATE TABLE IF NOT EXISTS public.week_off_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  is_off BOOLEAN NOT NULL DEFAULT false,
  alternate_pattern TEXT DEFAULT NULL CHECK (alternate_pattern IN (NULL, 'all', '1st_3rd', '2nd_4th', 'none')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(day_of_week)
);

-- User Leave Policy Assignment (for user-specific overrides)
CREATE TABLE IF NOT EXISTS public.user_leave_policy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  custom_entitlement INTEGER,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, leave_type_id, effective_from)
);

-- Enable RLS
ALTER TABLE public.leave_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.working_days_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.week_off_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_leave_policy ENABLE ROW LEVEL SECURITY;

-- RLS Policies using the existing is_admin_or_manager helper function
-- leave_policy
CREATE POLICY "Anyone can read leave policies" ON public.leave_policy
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage leave policies" ON public.leave_policy
  FOR ALL USING (public.is_admin_or_manager());

-- working_days_config
CREATE POLICY "Anyone can read working days config" ON public.working_days_config
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage working days config" ON public.working_days_config
  FOR ALL USING (public.is_admin_or_manager());

-- week_off_config
CREATE POLICY "Anyone can read week off config" ON public.week_off_config
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage week off config" ON public.week_off_config
  FOR ALL USING (public.is_admin_or_manager());

-- user_leave_policy
CREATE POLICY "Users can read their own leave policy" ON public.user_leave_policy
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin_or_manager());

CREATE POLICY "Admins can manage user leave policies" ON public.user_leave_policy
  FOR ALL USING (public.is_admin_or_manager());

-- Insert default week-off config (Sunday off by default)
INSERT INTO public.week_off_config (day_of_week, is_off, alternate_pattern)
VALUES 
  (0, true, 'all'),   -- Sunday - full off
  (1, false, 'none'), -- Monday
  (2, false, 'none'), -- Tuesday
  (3, false, 'none'), -- Wednesday
  (4, false, 'none'), -- Thursday
  (5, false, 'none'), -- Friday
  (6, false, '2nd_4th') -- Saturday - 2nd and 4th off
ON CONFLICT (day_of_week) DO NOTHING;

-- Create triggers for updated_at
CREATE OR REPLACE TRIGGER update_leave_policy_updated_at
  BEFORE UPDATE ON public.leave_policy
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_working_days_config_updated_at
  BEFORE UPDATE ON public.working_days_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_week_off_config_updated_at
  BEFORE UPDATE ON public.week_off_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_user_leave_policy_updated_at
  BEFORE UPDATE ON public.user_leave_policy
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
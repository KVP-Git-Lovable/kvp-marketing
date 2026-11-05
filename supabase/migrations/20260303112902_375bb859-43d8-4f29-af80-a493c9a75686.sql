
-- Global Leave Policy (singleton table)
CREATE TABLE public.global_leave_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT true,
  reset_cycle text NOT NULL DEFAULT 'calendar_year',
  custom_reset_date date DEFAULT null,
  allow_negative_balance boolean NOT NULL DEFAULT false,
  max_negative_limit integer NOT NULL DEFAULT 0,
  enable_carry_forward boolean NOT NULL DEFAULT false,
  max_carry_forward_limit integer NOT NULL DEFAULT 0,
  carry_forward_expiry_months integer DEFAULT null,
  min_notice_period_days integer NOT NULL DEFAULT 0,
  max_continuous_leave_days integer DEFAULT null,
  allow_backdated_leave boolean NOT NULL DEFAULT false,
  max_backdate_days integer NOT NULL DEFAULT 0,
  enable_half_day boolean NOT NULL DEFAULT true,
  enable_sandwich_rule boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enforce singleton: only 1 row allowed
CREATE UNIQUE INDEX global_leave_policy_singleton ON public.global_leave_policy ((true));

-- Leave Type Policy Override
CREATE TABLE public.leave_type_policy_override (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  override_enabled boolean NOT NULL DEFAULT false,
  allow_negative_balance boolean DEFAULT null,
  max_negative_limit integer DEFAULT null,
  enable_carry_forward boolean DEFAULT null,
  max_carry_forward_limit integer DEFAULT null,
  carry_forward_expiry_months integer DEFAULT null,
  custom_reset_cycle text DEFAULT null,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (leave_type_id)
);

-- Enable RLS
ALTER TABLE public.global_leave_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_type_policy_override ENABLE ROW LEVEL SECURITY;

-- RLS policies: admin-only read/write
CREATE POLICY "Admins can read global leave policy"
  ON public.global_leave_policy FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert global leave policy"
  ON public.global_leave_policy FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update global leave policy"
  ON public.global_leave_policy FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read leave type overrides"
  ON public.leave_type_policy_override FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert leave type overrides"
  ON public.leave_type_policy_override FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update leave type overrides"
  ON public.leave_type_policy_override FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete leave type overrides"
  ON public.leave_type_policy_override FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE TRIGGER update_global_leave_policy_updated_at
  BEFORE UPDATE ON public.global_leave_policy
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leave_type_policy_override_updated_at
  BEFORE UPDATE ON public.leave_type_policy_override
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default global policy
INSERT INTO public.global_leave_policy (
  is_enabled, reset_cycle, allow_negative_balance, max_negative_limit,
  enable_carry_forward, max_carry_forward_limit, carry_forward_expiry_months,
  min_notice_period_days, max_continuous_leave_days, allow_backdated_leave,
  max_backdate_days, enable_half_day, enable_sandwich_rule
) VALUES (
  true, 'calendar_year', false, 0,
  false, 0, null,
  0, null, false,
  0, true, false
);

-- Auto-create override rows for active leave types
INSERT INTO public.leave_type_policy_override (leave_type_id, override_enabled)
SELECT id, false FROM public.leave_types WHERE is_active = true;

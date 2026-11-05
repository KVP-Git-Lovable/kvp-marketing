
-- ============================================================
-- Phase 1: Server-Side Policy Resolution
-- ============================================================

CREATE OR REPLACE FUNCTION public.resolve_effective_leave_policy(
  p_user_id UUID,
  p_leave_type_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_global RECORD;
  v_override RECORD;
  v_result JSONB;
BEGIN
  SELECT * INTO v_global FROM global_leave_policy LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'No global leave policy configured');
  END IF;

  v_result := jsonb_build_object(
    'is_enabled', v_global.is_enabled,
    'enable_half_day', v_global.enable_half_day,
    'enable_sandwich_rule', v_global.enable_sandwich_rule,
    'allow_backdated_leave', v_global.allow_backdated_leave,
    'max_backdate_days', v_global.max_backdate_days,
    'min_notice_period_days', v_global.min_notice_period_days,
    'max_continuous_leave_days', v_global.max_continuous_leave_days,
    'allow_negative_balance', v_global.allow_negative_balance,
    'max_negative_limit', v_global.max_negative_limit,
    'enable_carry_forward', v_global.enable_carry_forward,
    'max_carry_forward_limit', v_global.max_carry_forward_limit,
    'reset_cycle', v_global.reset_cycle,
    'custom_reset_date', v_global.custom_reset_date
  );

  SELECT * INTO v_override 
  FROM leave_type_policy_override 
  WHERE leave_type_id = p_leave_type_id AND override_enabled = true;

  IF FOUND THEN
    IF v_override.allow_negative_balance IS NOT NULL THEN
      v_result := v_result || jsonb_build_object('allow_negative_balance', v_override.allow_negative_balance);
    END IF;
    IF v_override.max_negative_limit IS NOT NULL THEN
      v_result := v_result || jsonb_build_object('max_negative_limit', v_override.max_negative_limit);
    END IF;
    IF v_override.enable_carry_forward IS NOT NULL THEN
      v_result := v_result || jsonb_build_object('enable_carry_forward', v_override.enable_carry_forward);
    END IF;
    IF v_override.max_carry_forward_limit IS NOT NULL THEN
      v_result := v_result || jsonb_build_object('max_carry_forward_limit', v_override.max_carry_forward_limit);
    END IF;
    IF v_override.carry_forward_expiry_months IS NOT NULL THEN
      v_result := v_result || jsonb_build_object('carry_forward_expiry_months', v_override.carry_forward_expiry_months);
    END IF;
    IF v_override.custom_reset_cycle IS NOT NULL THEN
      v_result := v_result || jsonb_build_object('reset_cycle', v_override.custom_reset_cycle);
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

-- ============================================================
-- Phase 2: Server-Side Validation
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_leave_request(
  p_user_id UUID,
  p_leave_type_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_is_half_day BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy JSONB;
  v_leave_policy RECORD;
  v_balance NUMERIC;
  v_days_requested NUMERIC;
  v_overlapping INTEGER;
  v_days_in_month NUMERIC;
  v_balance_after NUMERIC;
  v_calculated RECORD;
BEGIN
  v_policy := resolve_effective_leave_policy(p_user_id, p_leave_type_id);
  
  IF v_policy ? 'error' THEN
    RETURN jsonb_build_object('is_valid', false, 'error_code', 'NO_POLICY', 'error_message', 'No leave policy configured');
  END IF;

  IF NOT (v_policy->>'is_enabled')::boolean THEN
    RETURN jsonb_build_object('is_valid', false, 'error_code', 'DISABLED', 'error_message', 'Leave applications are currently disabled');
  END IF;

  IF p_end_date < p_start_date THEN
    RETURN jsonb_build_object('is_valid', false, 'error_code', 'INVALID_DATES', 'error_message', 'End date cannot be before start date');
  END IF;

  SELECT * INTO v_calculated FROM calculate_leave_days(p_start_date, p_end_date, p_leave_type_id, p_is_half_day);
  v_days_requested := v_calculated.total_days;

  SELECT * INTO v_leave_policy FROM leave_policy 
  WHERE leave_type_id = p_leave_type_id AND is_active = true;

  IF NOT (v_policy->>'allow_backdated_leave')::boolean AND p_start_date < CURRENT_DATE THEN
    RETURN jsonb_build_object('is_valid', false, 'error_code', 'NO_BACKDATE', 'error_message', 'Backdated leave is not allowed');
  END IF;

  IF (v_policy->>'allow_backdated_leave')::boolean AND (v_policy->>'max_backdate_days')::integer > 0 THEN
    IF p_start_date < CURRENT_DATE - (v_policy->>'max_backdate_days')::integer THEN
      RETURN jsonb_build_object('is_valid', false, 'error_code', 'BACKDATE_LIMIT', 
        'error_message', format('Backdated leave cannot exceed %s days', (v_policy->>'max_backdate_days')::integer));
    END IF;
  END IF;

  IF (v_policy->>'min_notice_period_days')::integer > 0 AND p_start_date > CURRENT_DATE THEN
    IF p_start_date < CURRENT_DATE + (v_policy->>'min_notice_period_days')::integer THEN
      RETURN jsonb_build_object('is_valid', false, 'error_code', 'NOTICE_PERIOD',
        'error_message', format('Leave requires %s days advance notice', (v_policy->>'min_notice_period_days')::integer));
    END IF;
  END IF;

  IF v_policy->>'max_continuous_leave_days' IS NOT NULL THEN
    IF v_days_requested > (v_policy->>'max_continuous_leave_days')::integer THEN
      RETURN jsonb_build_object('is_valid', false, 'error_code', 'MAX_CONTINUOUS',
        'error_message', format('Maximum continuous leave is %s days. Requested: %s', 
          (v_policy->>'max_continuous_leave_days')::integer, v_days_requested));
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_overlapping FROM leave_applications
  WHERE user_id = p_user_id
    AND status NOT IN ('rejected', 'cancelled')
    AND (p_start_date, p_end_date) OVERLAPS (start_date, end_date);

  IF v_overlapping > 0 THEN
    RETURN jsonb_build_object('is_valid', false, 'error_code', 'OVERLAP', 'error_message', 'Overlapping leave request exists for these dates');
  END IF;

  IF v_leave_policy.max_leaves_per_month IS NOT NULL THEN
    SELECT COALESCE(SUM(days_requested), 0) INTO v_days_in_month
    FROM leave_applications
    WHERE user_id = p_user_id
      AND leave_type_id = p_leave_type_id
      AND status NOT IN ('rejected', 'cancelled')
      AND EXTRACT(MONTH FROM start_date) = EXTRACT(MONTH FROM p_start_date)
      AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM p_start_date);

    IF (v_days_in_month + v_days_requested) > v_leave_policy.max_leaves_per_month THEN
      RETURN jsonb_build_object('is_valid', false, 'error_code', 'MONTHLY_LIMIT',
        'error_message', format('Exceeds maximum %s leaves allowed per month', v_leave_policy.max_leaves_per_month));
    END IF;
  END IF;

  SELECT remaining_balance INTO v_balance FROM leave_balance
  WHERE user_id = p_user_id AND leave_type_id = p_leave_type_id AND year = EXTRACT(YEAR FROM p_start_date);

  v_balance := COALESCE(v_balance, 0);
  v_balance_after := v_balance - v_days_requested;

  IF NOT (v_policy->>'allow_negative_balance')::boolean AND v_balance_after < 0 THEN
    RETURN jsonb_build_object('is_valid', false, 'error_code', 'INSUFFICIENT_BALANCE',
      'error_message', format('Insufficient leave balance. Available: %s, Requested: %s', v_balance, v_days_requested),
      'days_requested', v_days_requested, 'balance_after', v_balance_after, 'current_balance', v_balance);
  END IF;

  IF (v_policy->>'allow_negative_balance')::boolean AND (v_policy->>'max_negative_limit')::integer > 0 THEN
    IF v_balance_after < -((v_policy->>'max_negative_limit')::integer) THEN
      RETURN jsonb_build_object('is_valid', false, 'error_code', 'NEGATIVE_LIMIT',
        'error_message', format('Exceeds maximum negative balance limit of %s days', (v_policy->>'max_negative_limit')::integer),
        'days_requested', v_days_requested, 'balance_after', v_balance_after, 'current_balance', v_balance);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'is_valid', true,
    'days_requested', v_days_requested,
    'balance_after', v_balance_after,
    'current_balance', v_balance,
    'sandwich_days', v_calculated.sandwich_days
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_leave_date_constraints(
  p_user_id UUID,
  p_leave_type_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy JSONB;
  v_max_backdate_date DATE;
  v_min_notice_date DATE;
BEGIN
  v_policy := resolve_effective_leave_policy(p_user_id, p_leave_type_id);
  
  IF v_policy ? 'error' THEN
    RETURN jsonb_build_object('error', 'No policy configured');
  END IF;

  IF (v_policy->>'allow_backdated_leave')::boolean THEN
    v_max_backdate_date := CURRENT_DATE - (v_policy->>'max_backdate_days')::integer;
  ELSE
    v_max_backdate_date := CURRENT_DATE;
  END IF;

  IF (v_policy->>'min_notice_period_days')::integer > 0 THEN
    v_min_notice_date := CURRENT_DATE + (v_policy->>'min_notice_period_days')::integer;
  ELSE
    v_min_notice_date := CURRENT_DATE;
  END IF;

  RETURN jsonb_build_object(
    'allow_half_day', (v_policy->>'enable_half_day')::boolean,
    'allow_backdated_leave', (v_policy->>'allow_backdated_leave')::boolean,
    'max_backdate_date', v_max_backdate_date,
    'min_notice_date', v_min_notice_date,
    'min_notice_period_days', (v_policy->>'min_notice_period_days')::integer,
    'max_continuous_days', v_policy->>'max_continuous_leave_days',
    'is_enabled', (v_policy->>'is_enabled')::boolean,
    'allow_negative_balance', (v_policy->>'allow_negative_balance')::boolean,
    'max_negative_limit', (v_policy->>'max_negative_limit')::integer
  );
END;
$$;

-- ============================================================
-- Phase 3: Configurable Accrual Engine
-- ============================================================

CREATE TABLE IF NOT EXISTS public.accrual_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'quarterly', 'annual')),
  divisor INTEGER NOT NULL DEFAULT 12,
  round_mode TEXT NOT NULL DEFAULT 'round' CHECK (round_mode IN ('floor', 'ceil', 'round')),
  prorate_joining BOOLEAN NOT NULL DEFAULT false,
  credit_day INTEGER NOT NULL DEFAULT 1 CHECK (credit_day BETWEEN 1 AND 28),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (leave_type_id)
);

ALTER TABLE public.accrual_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read accrual_config"
  ON public.accrual_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage accrual_config"
  ON public.accrual_config FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

INSERT INTO public.accrual_config (leave_type_id, frequency, divisor, round_mode, prorate_joining, credit_day)
SELECT 
  lp.leave_type_id,
  CASE WHEN lp.accrual_type = 'monthly' THEN 'monthly' ELSE 'annual' END,
  CASE WHEN lp.accrual_type = 'monthly' THEN 12 ELSE 1 END,
  'round',
  false,
  1
FROM leave_policy lp
WHERE lp.is_active = true
ON CONFLICT (leave_type_id) DO NOTHING;

-- Updated accrual function using accrual_config
CREATE OR REPLACE FUNCTION public.process_monthly_leave_accrual()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy RECORD;
  v_config RECORD;
  v_user RECORD;
  v_credit NUMERIC;
  v_current_year INTEGER;
  v_current_month INTEGER;
  v_already_credited BOOLEAN;
  v_should_credit BOOLEAN;
  v_accrual_type_label TEXT;
  v_joining_date DATE;
BEGIN
  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  v_current_month := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;
  
  FOR v_policy IN 
    SELECT lp.*, lt.name as leave_name 
    FROM leave_policy lp
    JOIN leave_types lt ON lt.id = lp.leave_type_id
    WHERE lp.is_active = true AND lp.accrual_type = 'monthly'
  LOOP
    SELECT * INTO v_config FROM accrual_config WHERE leave_type_id = v_policy.leave_type_id;
    
    v_should_credit := false;
    v_accrual_type_label := 'monthly';
    
    IF FOUND THEN
      CASE v_config.frequency
        WHEN 'monthly' THEN
          v_should_credit := true;
          v_accrual_type_label := 'monthly';
          CASE v_config.round_mode
            WHEN 'floor' THEN v_credit := FLOOR(v_policy.yearly_entitlement::numeric / v_config.divisor);
            WHEN 'ceil' THEN v_credit := CEIL(v_policy.yearly_entitlement::numeric / v_config.divisor);
            ELSE v_credit := ROUND(v_policy.yearly_entitlement::numeric / v_config.divisor, 2);
          END CASE;
        WHEN 'quarterly' THEN
          v_should_credit := v_current_month IN (1, 4, 7, 10);
          v_accrual_type_label := 'quarterly';
          CASE v_config.round_mode
            WHEN 'floor' THEN v_credit := FLOOR(v_policy.yearly_entitlement::numeric / v_config.divisor);
            WHEN 'ceil' THEN v_credit := CEIL(v_policy.yearly_entitlement::numeric / v_config.divisor);
            ELSE v_credit := ROUND(v_policy.yearly_entitlement::numeric / v_config.divisor, 2);
          END CASE;
        WHEN 'annual' THEN
          v_should_credit := v_current_month = 1;
          v_accrual_type_label := 'annual';
          v_credit := v_policy.yearly_entitlement::numeric;
        ELSE
          v_should_credit := true;
          v_credit := ROUND(v_policy.yearly_entitlement::numeric / 12.0, 2);
      END CASE;
    ELSE
      v_should_credit := true;
      v_credit := ROUND(v_policy.yearly_entitlement / 12.0, 2);
    END IF;

    IF NOT v_should_credit THEN
      CONTINUE;
    END IF;
    
    FOR v_user IN 
      SELECT id, created_at FROM profiles WHERE user_status = 'active'
    LOOP
      SELECT EXISTS (
        SELECT 1 FROM leave_accrual_log
        WHERE user_id = v_user.id
          AND leave_type_id = v_policy.leave_type_id
          AND year = v_current_year
          AND month = v_current_month
          AND accrual_type = v_accrual_type_label
      ) INTO v_already_credited;

      IF v_already_credited THEN
        CONTINUE;
      END IF;

      IF v_config IS NOT NULL AND v_config.prorate_joining THEN
        v_joining_date := v_user.created_at::date;
        IF EXTRACT(YEAR FROM v_joining_date) = v_current_year 
           AND EXTRACT(MONTH FROM v_joining_date) = v_current_month THEN
          v_credit := ROUND(
            v_credit * (
              (EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day'))::numeric 
               - EXTRACT(DAY FROM v_joining_date)::numeric + 1) 
              / EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day'))::numeric
            ), 2);
        END IF;
      END IF;

      INSERT INTO leave_balance (user_id, leave_type_id, year, opening_balance, used_balance)
      VALUES (v_user.id, v_policy.leave_type_id, v_current_year, 0, 0)
      ON CONFLICT (user_id, leave_type_id, year) DO NOTHING;
      
      UPDATE leave_balance
      SET opening_balance = opening_balance + v_credit,
          updated_at = now()
      WHERE user_id = v_user.id 
        AND leave_type_id = v_policy.leave_type_id
        AND year = v_current_year;
      
      INSERT INTO leave_accrual_log (user_id, leave_type_id, year, month, accrual_type, days_credited, balance_after, notes)
      VALUES (
        v_user.id, 
        v_policy.leave_type_id, 
        v_current_year, 
        v_current_month, 
        v_accrual_type_label, 
        v_credit,
        (SELECT remaining_balance FROM leave_balance 
         WHERE user_id = v_user.id AND leave_type_id = v_policy.leave_type_id AND year = v_current_year),
        v_accrual_type_label || ' accrual for ' || v_policy.leave_name
      );
    END LOOP;
  END LOOP;
END;
$$;


-- 1. resolve_effective_leave_policy: merges global + per-type override
CREATE OR REPLACE FUNCTION public.resolve_effective_leave_policy(p_leave_type_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_global RECORD;
  v_override RECORD;
  v_result jsonb;
BEGIN
  SELECT * INTO v_global FROM global_leave_policy LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'No global leave policy configured');
  END IF;

  SELECT * INTO v_override FROM leave_type_policy_override
  WHERE leave_type_id = p_leave_type_id AND override_enabled = true;

  v_result := jsonb_build_object(
    'is_enabled', v_global.is_enabled,
    'allow_half_day', v_global.enable_half_day,
    'enable_sandwich_rule', v_global.enable_sandwich_rule,
    'allow_backdated_leave', v_global.allow_backdated_leave,
    'max_backdate_days', v_global.max_backdate_days,
    'min_notice_period_days', v_global.min_notice_period_days,
    'max_continuous_leave_days', v_global.max_continuous_leave_days,
    'allow_negative_balance', COALESCE(v_override.allow_negative_balance, v_global.allow_negative_balance),
    'max_negative_limit', COALESCE(v_override.max_negative_limit, v_global.max_negative_limit),
    'enable_carry_forward', COALESCE(v_override.enable_carry_forward, v_global.enable_carry_forward),
    'max_carry_forward_limit', COALESCE(v_override.max_carry_forward_limit, v_global.max_carry_forward_limit)
  );

  RETURN v_result;
END;
$$;

-- 2. get_leave_date_constraints: returns date boundaries for the UI calendar
CREATE OR REPLACE FUNCTION public.get_leave_date_constraints(p_user_id uuid, p_leave_type_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_policy jsonb;
  v_allow_backdate boolean;
  v_max_backdate int;
  v_min_notice int;
  v_balance numeric;
BEGIN
  v_policy := resolve_effective_leave_policy(p_leave_type_id);
  
  IF v_policy ? 'error' THEN
    RETURN v_policy;
  END IF;

  v_allow_backdate := (v_policy->>'allow_backdated_leave')::boolean;
  v_max_backdate := COALESCE((v_policy->>'max_backdate_days')::int, 0);
  v_min_notice := COALESCE((v_policy->>'min_notice_period_days')::int, 0);

  -- Get current balance
  SELECT COALESCE(remaining_balance, 0) INTO v_balance
  FROM leave_balance
  WHERE user_id = p_user_id AND leave_type_id = p_leave_type_id
    AND year = EXTRACT(YEAR FROM CURRENT_DATE)::int;

  RETURN jsonb_build_object(
    'allow_half_day', (v_policy->>'allow_half_day')::boolean,
    'allow_backdated_leave', v_allow_backdate,
    'max_backdate_date', CASE WHEN v_allow_backdate THEN (CURRENT_DATE - v_max_backdate)::text ELSE CURRENT_DATE::text END,
    'min_notice_date', (CURRENT_DATE + v_min_notice)::text,
    'min_notice_period_days', v_min_notice,
    'max_continuous_days', (v_policy->>'max_continuous_leave_days'),
    'is_enabled', (v_policy->>'is_enabled')::boolean,
    'allow_negative_balance', (v_policy->>'allow_negative_balance')::boolean,
    'max_negative_limit', (v_policy->>'max_negative_limit')::int,
    'current_balance', COALESCE(v_balance, 0)
  );
END;
$$;

-- 3. validate_leave_request: full server-side validation
CREATE OR REPLACE FUNCTION public.validate_leave_request(
  p_user_id uuid,
  p_leave_type_id uuid,
  p_start_date date,
  p_end_date date,
  p_is_half_day boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_policy jsonb;
  v_days numeric;
  v_balance numeric;
  v_max_neg int;
  v_allow_neg boolean;
  v_overlapping int;
  v_sandwich int := 0;
BEGIN
  v_policy := resolve_effective_leave_policy(p_leave_type_id);
  
  IF v_policy ? 'error' THEN
    RETURN jsonb_build_object('is_valid', false, 'error_code', 'NO_POLICY', 'error_message', v_policy->>'error');
  END IF;

  -- Check enabled
  IF NOT (v_policy->>'is_enabled')::boolean THEN
    RETURN jsonb_build_object('is_valid', false, 'error_code', 'DISABLED', 'error_message', 'Leave applications are disabled');
  END IF;

  -- Check dates
  IF p_end_date < p_start_date THEN
    RETURN jsonb_build_object('is_valid', false, 'error_code', 'INVALID_DATES', 'error_message', 'End date cannot be before start date');
  END IF;

  -- Calculate days
  v_days := (p_end_date - p_start_date + 1);
  IF p_is_half_day THEN v_days := 0.5; END IF;

  -- Check backdate
  IF p_start_date < CURRENT_DATE THEN
    IF NOT (v_policy->>'allow_backdated_leave')::boolean THEN
      RETURN jsonb_build_object('is_valid', false, 'error_code', 'NO_BACKDATE', 'error_message', 'Backdated leave is not allowed');
    END IF;
    IF p_start_date < CURRENT_DATE - COALESCE((v_policy->>'max_backdate_days')::int, 0) THEN
      RETURN jsonb_build_object('is_valid', false, 'error_code', 'BACKDATE_EXCEEDED',
        'error_message', 'Backdated leave cannot exceed ' || (v_policy->>'max_backdate_days') || ' days');
    END IF;
  END IF;

  -- Check notice period for future dates
  IF p_start_date > CURRENT_DATE AND COALESCE((v_policy->>'min_notice_period_days')::int, 0) > 0 THEN
    IF p_start_date < CURRENT_DATE + (v_policy->>'min_notice_period_days')::int THEN
      RETURN jsonb_build_object('is_valid', false, 'error_code', 'NOTICE_PERIOD',
        'error_message', 'Leave requires ' || (v_policy->>'min_notice_period_days') || ' days advance notice');
    END IF;
  END IF;

  -- Check max continuous days
  IF (v_policy->>'max_continuous_leave_days') IS NOT NULL AND v_days > (v_policy->>'max_continuous_leave_days')::int THEN
    RETURN jsonb_build_object('is_valid', false, 'error_code', 'MAX_CONTINUOUS',
      'error_message', 'Cannot take more than ' || (v_policy->>'max_continuous_leave_days') || ' continuous days');
  END IF;

  -- Check overlap
  SELECT COUNT(*) INTO v_overlapping FROM leave_applications
  WHERE user_id = p_user_id
    AND status NOT IN ('rejected', 'cancelled')
    AND (p_start_date, p_end_date) OVERLAPS (start_date, end_date);
  IF v_overlapping > 0 THEN
    RETURN jsonb_build_object('is_valid', false, 'error_code', 'OVERLAP', 'error_message', 'Overlapping leave request exists');
  END IF;

  -- Check balance
  SELECT COALESCE(remaining_balance, 0) INTO v_balance FROM leave_balance
  WHERE user_id = p_user_id AND leave_type_id = p_leave_type_id
    AND year = EXTRACT(YEAR FROM p_start_date)::int;

  v_allow_neg := COALESCE((v_policy->>'allow_negative_balance')::boolean, false);
  v_max_neg := COALESCE((v_policy->>'max_negative_limit')::int, 0);

  IF COALESCE(v_balance, 0) < v_days THEN
    IF NOT v_allow_neg THEN
      RETURN jsonb_build_object('is_valid', false, 'error_code', 'INSUFFICIENT_BALANCE',
        'error_message', 'Insufficient leave balance. Available: ' || COALESCE(v_balance, 0) || ', Requested: ' || v_days,
        'current_balance', COALESCE(v_balance, 0), 'days_requested', v_days);
    END IF;
    IF ABS(COALESCE(v_balance, 0) - v_days) > v_max_neg THEN
      RETURN jsonb_build_object('is_valid', false, 'error_code', 'NEGATIVE_LIMIT',
        'error_message', 'Exceeds maximum negative balance limit of ' || v_max_neg || ' days',
        'current_balance', COALESCE(v_balance, 0), 'days_requested', v_days);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'is_valid', true,
    'days_requested', v_days,
    'current_balance', COALESCE(v_balance, 0),
    'balance_after', COALESCE(v_balance, 0) - v_days,
    'sandwich_days', v_sandwich
  );
END;
$$;

-- 4. Update the legacy trigger to use global policy instead of leave_policy fields
CREATE OR REPLACE FUNCTION public.validate_leave_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance NUMERIC;
  v_policy jsonb;
  v_overlapping INTEGER;
  v_days NUMERIC;
  v_allow_neg BOOLEAN;
  v_max_neg INT;
  v_max_backdate INT;
  v_allow_backdate BOOLEAN;
  v_min_notice INT;
  v_max_per_month NUMERIC;
  v_days_in_month NUMERIC;
BEGIN
  -- Resolve effective policy from global + override
  v_policy := resolve_effective_leave_policy(NEW.leave_type_id);
  
  IF v_policy ? 'error' THEN
    RAISE EXCEPTION 'Leave policy not configured: %', v_policy->>'error';
  END IF;

  -- Check overlapping leaves (exclude current row on UPDATE)
  SELECT COUNT(*) INTO v_overlapping FROM leave_applications
  WHERE user_id = NEW.user_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND status NOT IN ('rejected', 'cancelled')
    AND (NEW.start_date, NEW.end_date) OVERLAPS (start_date, end_date);
  
  IF v_overlapping > 0 THEN
    RAISE EXCEPTION 'Overlapping leave request exists for these dates';
  END IF;
  
  -- Check backdated limit using global policy
  v_allow_backdate := COALESCE((v_policy->>'allow_backdated_leave')::boolean, false);
  v_max_backdate := COALESCE((v_policy->>'max_backdate_days')::int, 0);
  
  IF NEW.start_date < CURRENT_DATE THEN
    IF NOT v_allow_backdate THEN
      RAISE EXCEPTION 'Backdated leave is not allowed by policy';
    END IF;
    IF NEW.start_date < CURRENT_DATE - v_max_backdate THEN
      RAISE EXCEPTION 'Backdated leave request exceeds allowed limit of % days', v_max_backdate;
    END IF;
  END IF;
  
  -- Check advance notice using global policy
  v_min_notice := COALESCE((v_policy->>'min_notice_period_days')::int, 0);
  IF v_min_notice > 0 AND NEW.start_date > CURRENT_DATE THEN
    IF NEW.start_date < CURRENT_DATE + v_min_notice THEN
      RAISE EXCEPTION 'Leave request requires % days advance notice', v_min_notice;
    END IF;
  END IF;
  
  -- Calculate days
  v_days := (NEW.end_date - NEW.start_date + 1);
  IF COALESCE(NEW.is_half_day, false) THEN
    v_days := 0.5;
  END IF;
  NEW.days_requested := v_days;
  
  -- Check max continuous days
  IF (v_policy->>'max_continuous_leave_days') IS NOT NULL AND v_days > (v_policy->>'max_continuous_leave_days')::int THEN
    RAISE EXCEPTION 'Cannot take more than % continuous leave days', (v_policy->>'max_continuous_leave_days')::int;
  END IF;

  -- Check max leaves per month (from leave_policy if exists)
  SELECT max_leaves_per_month INTO v_max_per_month FROM leave_policy
  WHERE leave_type_id = NEW.leave_type_id AND is_active = true;
  
  IF v_max_per_month IS NOT NULL THEN
    SELECT COALESCE(SUM(days_requested), 0) INTO v_days_in_month
    FROM leave_applications
    WHERE user_id = NEW.user_id
      AND leave_type_id = NEW.leave_type_id
      AND status NOT IN ('rejected', 'cancelled')
      AND EXTRACT(MONTH FROM start_date) = EXTRACT(MONTH FROM NEW.start_date)
      AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM NEW.start_date)
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF (v_days_in_month + v_days) > v_max_per_month THEN
      RAISE EXCEPTION 'Exceeds maximum % leaves allowed per month', v_max_per_month;
    END IF;
  END IF;
  
  -- Check balance
  SELECT remaining_balance INTO v_balance FROM leave_balance
  WHERE user_id = NEW.user_id 
    AND leave_type_id = NEW.leave_type_id 
    AND year = EXTRACT(YEAR FROM NEW.start_date);
  
  v_allow_neg := COALESCE((v_policy->>'allow_negative_balance')::boolean, false);
  v_max_neg := COALESCE((v_policy->>'max_negative_limit')::int, 0);
  
  IF COALESCE(v_balance, 0) < v_days AND NOT v_allow_neg THEN
    RAISE EXCEPTION 'Insufficient leave balance. Available: %, Requested: %', COALESCE(v_balance, 0), v_days;
  END IF;
  
  IF v_allow_neg AND (COALESCE(v_balance, 0) - v_days) < -v_max_neg THEN
    RAISE EXCEPTION 'Exceeds maximum negative balance limit of % days', v_max_neg;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 5. Grant execute to authenticated
GRANT EXECUTE ON FUNCTION public.resolve_effective_leave_policy(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leave_date_constraints(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_leave_request(uuid, uuid, date, date, boolean) TO authenticated;

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';


-- Function: initialize_leave_policy_balances
CREATE OR REPLACE FUNCTION public.initialize_leave_policy_balances(p_policy_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_policy RECORD;
  v_user RECORD;
  v_credit NUMERIC;
  v_current_year INTEGER;
  v_current_month INTEGER;
  v_month INTEGER;
  v_already_credited BOOLEAN;
BEGIN
  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  v_current_month := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;

  SELECT lp.leave_type_id, lp.yearly_entitlement, lp.accrual_type, lt.name as leave_name
  INTO v_policy
  FROM leave_policy lp
  JOIN leave_types lt ON lt.id = lp.leave_type_id
  WHERE lp.id = p_policy_id AND lp.accrual_type = 'monthly';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_credit := ROUND(v_policy.yearly_entitlement / 12.0, 2);

  FOR v_user IN SELECT id FROM profiles WHERE user_status = 'active'
  LOOP
    INSERT INTO leave_balance (user_id, leave_type_id, year, opening_balance, used_balance)
    VALUES (v_user.id, v_policy.leave_type_id, v_current_year, 0, 0)
    ON CONFLICT (user_id, leave_type_id, year) DO NOTHING;

    FOR v_month IN 1..v_current_month
    LOOP
      SELECT EXISTS (
        SELECT 1 FROM leave_accrual_log
        WHERE user_id = v_user.id
          AND leave_type_id = v_policy.leave_type_id
          AND year = v_current_year
          AND month = v_month
          AND accrual_type = 'monthly'
      ) INTO v_already_credited;

      IF NOT v_already_credited THEN
        UPDATE leave_balance
        SET opening_balance = opening_balance + v_credit, updated_at = now()
        WHERE user_id = v_user.id
          AND leave_type_id = v_policy.leave_type_id
          AND year = v_current_year;

        INSERT INTO leave_accrual_log (user_id, leave_type_id, year, month, accrual_type, days_credited, balance_after, notes)
        VALUES (
          v_user.id, v_policy.leave_type_id, v_current_year, v_month, 'monthly', v_credit,
          (SELECT remaining_balance FROM leave_balance
           WHERE user_id = v_user.id AND leave_type_id = v_policy.leave_type_id AND year = v_current_year),
          'Backfill month ' || v_month || ' for ' || v_policy.leave_name
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;

-- Trigger function
CREATE OR REPLACE FUNCTION public.trigger_initialize_leave_policy_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.accrual_type = 'monthly' THEN
    PERFORM initialize_leave_policy_balances(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

-- Trigger on leave_policy INSERT
DROP TRIGGER IF EXISTS trg_initialize_leave_policy_balances ON leave_policy;
CREATE TRIGGER trg_initialize_leave_policy_balances
  AFTER INSERT ON leave_policy
  FOR EACH ROW
  EXECUTE FUNCTION trigger_initialize_leave_policy_balances();

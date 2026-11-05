CREATE OR REPLACE FUNCTION public.process_monthly_leave_accrual()
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
  v_already_credited BOOLEAN;
BEGIN
  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  v_current_month := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;
  
  FOR v_policy IN 
    SELECT lp.*, lt.name as leave_name FROM leave_policy lp
    JOIN leave_types lt ON lt.id = lp.leave_type_id
    WHERE lp.is_active = true AND lp.accrual_type = 'monthly'
  LOOP
    v_credit := ROUND(v_policy.yearly_entitlement / 12.0, 2);
    
    FOR v_user IN 
      SELECT id FROM profiles WHERE user_status = 'active'
    LOOP
      -- Duplicate prevention: skip if already credited this month
      SELECT EXISTS (
        SELECT 1 FROM leave_accrual_log
        WHERE user_id = v_user.id
          AND leave_type_id = v_policy.leave_type_id
          AND year = v_current_year
          AND month = v_current_month
          AND accrual_type = 'monthly'
      ) INTO v_already_credited;

      IF v_already_credited THEN
        CONTINUE;
      END IF;

      -- Ensure balance record exists
      INSERT INTO leave_balance (user_id, leave_type_id, year, opening_balance, used_balance)
      VALUES (v_user.id, v_policy.leave_type_id, v_current_year, 0, 0)
      ON CONFLICT (user_id, leave_type_id, year) DO NOTHING;
      
      -- Credit the balance
      UPDATE leave_balance
      SET opening_balance = opening_balance + v_credit,
          updated_at = now()
      WHERE user_id = v_user.id 
        AND leave_type_id = v_policy.leave_type_id
        AND year = v_current_year;
      
      -- Log the accrual
      INSERT INTO leave_accrual_log (user_id, leave_type_id, year, month, accrual_type, days_credited, balance_after, notes)
      VALUES (
        v_user.id, 
        v_policy.leave_type_id, 
        v_current_year, 
        v_current_month, 
        'monthly', 
        v_credit,
        (SELECT remaining_balance FROM leave_balance 
         WHERE user_id = v_user.id AND leave_type_id = v_policy.leave_type_id AND year = v_current_year),
        'Monthly accrual for ' || v_policy.leave_name
      );
    END LOOP;
  END LOOP;
END;
$function$;
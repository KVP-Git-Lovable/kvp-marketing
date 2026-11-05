
-- Fix Bug 2: process_monthly_leave_accrual updates remaining_balance (generated column)
-- Fix: update opening_balance instead, so remaining_balance = opening_balance - used_balance reflects correctly
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
      -- Ensure balance record exists (no remaining_balance — it's a generated column)
      INSERT INTO leave_balance (user_id, leave_type_id, year, opening_balance, used_balance)
      VALUES (v_user.id, v_policy.leave_type_id, v_current_year, 0, 0)
      ON CONFLICT (user_id, leave_type_id, year) DO NOTHING;
      
      -- Credit the balance by incrementing opening_balance
      -- remaining_balance is GENERATED AS (opening_balance - used_balance), so this is correct
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

-- Fix Bug 3: update_leave_balance_on_approval uses raw date diff, ignoring days_requested
-- Fix: use COALESCE(NEW.days_requested, raw date diff) so half-days and sandwich rules are respected
CREATE OR REPLACE FUNCTION public.update_leave_balance_on_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    leave_days NUMERIC;
BEGIN
    -- Only update balance when status changes to approved
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        -- Use days_requested (already accounts for half-day, sandwich rules, etc.)
        -- Fall back to raw date diff only if days_requested is null
        leave_days := COALESCE(NEW.days_requested, NEW.end_date - NEW.start_date + 1);
        
        -- Update or insert leave balance
        INSERT INTO public.leave_balance (user_id, leave_type_id, year, opening_balance, used_balance)
        VALUES (NEW.user_id, NEW.leave_type_id, EXTRACT(YEAR FROM NEW.start_date)::INTEGER, 0, leave_days)
        ON CONFLICT (user_id, leave_type_id, year)
        DO UPDATE SET 
            used_balance = public.leave_balance.used_balance + leave_days,
            updated_at = now();
    END IF;
    
    RETURN NEW;
END;
$function$;

-- Fix Bug 2b: process_year_end_carry_forward also writes remaining_balance (generated column)
-- Fix: remove remaining_balance from INSERT and UPDATE payloads
CREATE OR REPLACE FUNCTION public.process_year_end_carry_forward()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_policy RECORD;
  v_balance RECORD;
  v_carry NUMERIC;
  v_new_year INTEGER;
BEGIN
  v_new_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  
  FOR v_policy IN 
    SELECT lp.*, lt.name as leave_name FROM leave_policy lp
    JOIN leave_types lt ON lt.id = lp.leave_type_id
    WHERE lp.is_active = true
  LOOP
    FOR v_balance IN 
      SELECT * FROM leave_balance 
      WHERE leave_type_id = v_policy.leave_type_id 
        AND year = v_new_year - 1
        AND remaining_balance > 0
    LOOP
      IF v_policy.carry_forward_allowed THEN
        v_carry := LEAST(v_balance.remaining_balance, COALESCE(v_policy.max_carry_forward, v_balance.remaining_balance));
      ELSE
        v_carry := 0;
      END IF;
      
      -- Create or update new year balance with carry forward
      -- remaining_balance is GENERATED AS (opening_balance - used_balance), do NOT write it
      INSERT INTO leave_balance (user_id, leave_type_id, year, opening_balance, used_balance)
      VALUES (v_balance.user_id, v_policy.leave_type_id, v_new_year, 
              v_policy.yearly_entitlement + v_carry, 0)
      ON CONFLICT (user_id, leave_type_id, year) 
      DO UPDATE SET 
        opening_balance = leave_balance.opening_balance + v_carry,
        updated_at = now();
      
      -- Log carry forward
      IF v_carry > 0 THEN
        INSERT INTO leave_accrual_log (user_id, leave_type_id, year, accrual_type, days_credited, balance_after, notes)
        VALUES (
          v_balance.user_id, 
          v_policy.leave_type_id, 
          v_new_year, 
          'carry_forward', 
          v_carry,
          (SELECT remaining_balance FROM leave_balance 
           WHERE user_id = v_balance.user_id AND leave_type_id = v_policy.leave_type_id AND year = v_new_year),
          'Carried forward from ' || (v_new_year - 1) || ': ' || v_policy.leave_name
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$function$;

-- 1. Add update mode columns to leave_policy
ALTER TABLE leave_policy
  ADD COLUMN IF NOT EXISTS last_update_mode TEXT DEFAULT 'next_month',
  ADD COLUMN IF NOT EXISTS last_update_effective_date DATE;

-- 2. Create recalculation function
CREATE OR REPLACE FUNCTION public.recalculate_leave_accrual_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user RECORD;
  v_new_credit NUMERIC;
  v_old_credit NUMERIC;
  v_current_year INTEGER;
  v_current_month INTEGER;
  v_month INTEGER;
  v_update_mode TEXT;
  v_total_new_credit NUMERIC;
  v_existing_used NUMERIC;
  v_leave_name TEXT;
BEGIN
  -- Only act on monthly accrual policies when entitlement or accrual_type changes
  IF OLD.yearly_entitlement = NEW.yearly_entitlement 
     AND OLD.accrual_type = NEW.accrual_type THEN
    RETURN NEW;
  END IF;

  -- Only handle monthly accrual recalculation
  IF NEW.accrual_type != 'monthly' THEN
    RETURN NEW;
  END IF;

  v_update_mode := COALESCE(NEW.last_update_mode, 'next_month');
  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  v_current_month := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;
  v_new_credit := ROUND(NEW.yearly_entitlement / 12.0, 2);
  v_old_credit := ROUND(OLD.yearly_entitlement / 12.0, 2);

  SELECT name INTO v_leave_name FROM leave_types WHERE id = NEW.leave_type_id;

  IF v_update_mode = 'next_month' THEN
    RETURN NEW;
  END IF;

  FOR v_user IN SELECT id FROM profiles WHERE user_status = 'active'
  LOOP
    INSERT INTO leave_balance (user_id, leave_type_id, year, opening_balance, used_balance)
    VALUES (v_user.id, NEW.leave_type_id, v_current_year, 0, 0)
    ON CONFLICT (user_id, leave_type_id, year) DO NOTHING;

    IF v_update_mode = 'retroactive' THEN
      v_total_new_credit := v_new_credit * v_current_month;

      SELECT COALESCE(used_balance, 0) INTO v_existing_used
      FROM leave_balance
      WHERE user_id = v_user.id
        AND leave_type_id = NEW.leave_type_id
        AND year = v_current_year;

      UPDATE leave_balance
      SET opening_balance = v_total_new_credit,
          updated_at = now()
      WHERE user_id = v_user.id
        AND leave_type_id = NEW.leave_type_id
        AND year = v_current_year;

      UPDATE leave_accrual_log
      SET days_credited = v_new_credit,
          notes = 'Retroactive recalc: ' || COALESCE(v_leave_name, 'Leave') || ' (entitlement changed to ' || NEW.yearly_entitlement || ')'
      WHERE user_id = v_user.id
        AND leave_type_id = NEW.leave_type_id
        AND year = v_current_year
        AND accrual_type = 'monthly';

      INSERT INTO leave_accrual_log (user_id, leave_type_id, year, month, accrual_type, days_credited, balance_after, notes)
      VALUES (
        v_user.id, NEW.leave_type_id, v_current_year, v_current_month, 'adjustment', 0,
        v_total_new_credit - v_existing_used,
        'Retroactive recalc applied: entitlement changed from ' || OLD.yearly_entitlement || ' to ' || NEW.yearly_entitlement
      );

    ELSIF v_update_mode = 'current_month' THEN
      IF EXISTS (
        SELECT 1 FROM leave_accrual_log
        WHERE user_id = v_user.id
          AND leave_type_id = NEW.leave_type_id
          AND year = v_current_year
          AND month = v_current_month
          AND accrual_type = 'monthly'
      ) THEN
        UPDATE leave_balance
        SET opening_balance = opening_balance + (v_new_credit - v_old_credit),
            updated_at = now()
        WHERE user_id = v_user.id
          AND leave_type_id = NEW.leave_type_id
          AND year = v_current_year;

        UPDATE leave_accrual_log
        SET days_credited = v_new_credit,
            notes = 'Adjusted current month: entitlement changed to ' || NEW.yearly_entitlement
        WHERE user_id = v_user.id
          AND leave_type_id = NEW.leave_type_id
          AND year = v_current_year
          AND month = v_current_month
          AND accrual_type = 'monthly';
      END IF;

      INSERT INTO leave_accrual_log (user_id, leave_type_id, year, month, accrual_type, days_credited, balance_after, notes)
      VALUES (
        v_user.id, NEW.leave_type_id, v_current_year, v_current_month, 'adjustment',
        v_new_credit - v_old_credit,
        (SELECT remaining_balance FROM leave_balance
         WHERE user_id = v_user.id AND leave_type_id = NEW.leave_type_id AND year = v_current_year),
        'Current month forward: entitlement changed from ' || OLD.yearly_entitlement || ' to ' || NEW.yearly_entitlement
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- 3. Create the AFTER UPDATE trigger
DROP TRIGGER IF EXISTS trg_leave_policy_accrual_update ON leave_policy;
CREATE TRIGGER trg_leave_policy_accrual_update
  AFTER UPDATE ON leave_policy
  FOR EACH ROW
  WHEN (OLD.yearly_entitlement IS DISTINCT FROM NEW.yearly_entitlement
     OR OLD.accrual_type IS DISTINCT FROM NEW.accrual_type)
  EXECUTE FUNCTION recalculate_leave_accrual_on_update();
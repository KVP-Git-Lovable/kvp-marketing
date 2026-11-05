
-- Drop the old trigger (correct name)
DROP TRIGGER IF EXISTS update_leave_balance_on_approval ON public.leave_applications;

-- Drop the old function with CASCADE
DROP FUNCTION IF EXISTS public.update_leave_balance_on_approval() CASCADE;

-- Create new function that handles INSERT and UPDATE
CREATE OR REPLACE FUNCTION public.update_leave_balance_on_status_change()
RETURNS trigger AS $$
DECLARE
  leave_days NUMERIC;
BEGIN
  leave_days := COALESCE(NEW.days_requested, NEW.end_date - NEW.start_date + 1);

  -- NEW application (INSERT): deduct immediately
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.leave_balance (user_id, leave_type_id, year, opening_balance, used_balance)
    VALUES (NEW.user_id, NEW.leave_type_id, EXTRACT(YEAR FROM NEW.start_date)::INTEGER, 0, leave_days)
    ON CONFLICT (user_id, leave_type_id, year)
    DO UPDATE SET
      used_balance = leave_balance.used_balance + leave_days,
      updated_at = now();
    RETURN NEW;
  END IF;

  -- UPDATE: if status changed to rejected/cancelled, restore balance
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IN ('rejected', 'cancelled') AND OLD.status NOT IN ('rejected', 'cancelled') THEN
      UPDATE public.leave_balance
      SET used_balance = GREATEST(0, used_balance - leave_days), updated_at = now()
      WHERE user_id = NEW.user_id
        AND leave_type_id = NEW.leave_type_id
        AND year = EXTRACT(YEAR FROM NEW.start_date)::INTEGER;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Create new trigger on both INSERT and UPDATE
CREATE TRIGGER update_leave_balance_on_status_change_trigger
  AFTER INSERT OR UPDATE ON public.leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_leave_balance_on_status_change();

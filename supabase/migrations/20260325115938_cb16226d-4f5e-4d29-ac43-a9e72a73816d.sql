-- Reattach all missing triggers on leave_applications + add balance tracking

-- 1. Validation trigger (BEFORE INSERT)
DROP TRIGGER IF EXISTS trg_validate_leave ON public.leave_applications;
CREATE TRIGGER trg_validate_leave
  BEFORE INSERT ON public.leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_leave_application();

-- 2. Approval request creation trigger (AFTER INSERT)
DROP TRIGGER IF EXISTS trg_leave_approval_request ON public.leave_applications;
CREATE TRIGGER trg_leave_approval_request
  AFTER INSERT ON public.leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_create_leave_approval_request();

-- 3. Balance update on approval (AFTER UPDATE) - existing function
DROP TRIGGER IF EXISTS trg_update_balance_on_approval ON public.leave_applications;
CREATE TRIGGER trg_update_balance_on_approval
  AFTER UPDATE OF status ON public.leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_leave_balance_on_approval();

-- 4. Attendance marking on approval (AFTER UPDATE) - existing function
DROP TRIGGER IF EXISTS trg_mark_attendance_on_approval ON public.leave_applications;
CREATE TRIGGER trg_mark_attendance_on_approval
  AFTER UPDATE OF status ON public.leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_attendance_on_leave_approval();

-- 5. NEW: Track used_balance immediately on submit (Booked = pending + approved)
CREATE OR REPLACE FUNCTION public.update_leave_balance_on_submit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_days NUMERIC;
  v_year INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM COALESCE(NEW.start_date, OLD.start_date));

  IF TG_OP = 'INSERT' AND NEW.status IN ('pending', 'approved') THEN
    v_days := COALESCE(NEW.days_requested, NEW.end_date - NEW.start_date + 1);
    IF COALESCE(NEW.is_half_day, false) THEN v_days := 0.5; END IF;

    -- Ensure balance row exists
    INSERT INTO leave_balance (user_id, leave_type_id, year, opening_balance, used_balance)
    VALUES (NEW.user_id, NEW.leave_type_id, v_year, 0, 0)
    ON CONFLICT (user_id, leave_type_id, year) DO NOTHING;

    UPDATE leave_balance
    SET used_balance = used_balance + v_days, updated_at = now()
    WHERE user_id = NEW.user_id AND leave_type_id = NEW.leave_type_id AND year = v_year;

  ELSIF TG_OP = 'UPDATE' AND OLD.status IN ('pending', 'approved') AND NEW.status IN ('rejected', 'cancelled') THEN
    v_days := COALESCE(OLD.days_requested, OLD.end_date - OLD.start_date + 1);
    IF COALESCE(OLD.is_half_day, false) THEN v_days := 0.5; END IF;

    UPDATE leave_balance
    SET used_balance = GREATEST(0, used_balance - v_days), updated_at = now()
    WHERE user_id = OLD.user_id AND leave_type_id = OLD.leave_type_id AND year = v_year;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_balance_on_submit ON public.leave_applications;
CREATE TRIGGER trg_update_balance_on_submit
  AFTER INSERT OR UPDATE OF status ON public.leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_leave_balance_on_submit();

-- 6. Also reattach regularization approval trigger
DROP TRIGGER IF EXISTS trg_regularization_approval_request ON public.regularization_requests;
CREATE TRIGGER trg_regularization_approval_request
  AFTER INSERT ON public.regularization_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_create_regularization_approval_request();

NOTIFY pgrst, 'reload schema';
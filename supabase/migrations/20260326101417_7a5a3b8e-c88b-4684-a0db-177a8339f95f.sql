
CREATE OR REPLACE FUNCTION public.apply_regularization_to_attendance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_attendance_id uuid;
  v_check_in timestamptz;
  v_check_out timestamptz;
  v_total_hours numeric;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    SELECT id, check_in_time, check_out_time 
    INTO v_attendance_id, v_check_in, v_check_out
    FROM attendance 
    WHERE user_id = NEW.user_id AND date = NEW.attendance_date
    LIMIT 1;

    v_check_in := COALESCE(NEW.requested_check_in_time, v_check_in);
    v_check_out := COALESCE(NEW.requested_check_out_time, v_check_out);
    
    IF v_check_in IS NOT NULL AND v_check_out IS NOT NULL THEN
      v_total_hours := ROUND(EXTRACT(EPOCH FROM (v_check_out - v_check_in)) / 3600.0, 2);
    END IF;

    IF v_attendance_id IS NOT NULL THEN
      UPDATE attendance SET
        check_in_time = v_check_in,
        check_out_time = v_check_out,
        total_hours = v_total_hours,
        status = 'regularized',
        regularized_request_id = NEW.id,
        updated_at = now()
      WHERE id = v_attendance_id;
    ELSE
      INSERT INTO attendance (user_id, date, check_in_time, check_out_time, total_hours, status, regularized_request_id)
      VALUES (NEW.user_id, NEW.attendance_date, v_check_in, v_check_out, v_total_hours, 'regularized', NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_regularization ON regularization_requests;
CREATE TRIGGER trg_apply_regularization
  AFTER UPDATE OF status ON regularization_requests
  FOR EACH ROW
  EXECUTE FUNCTION apply_regularization_to_attendance();

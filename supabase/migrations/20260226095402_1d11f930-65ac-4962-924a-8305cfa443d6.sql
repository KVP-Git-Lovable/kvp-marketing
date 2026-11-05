
-- Function: apply regularization times to attendance on approval
CREATE OR REPLACE FUNCTION public.apply_regularization_to_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_id uuid;
  v_check_in timestamptz;
  v_check_out timestamptz;
  v_total_hours numeric;
BEGIN
  -- Only fire when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN

    -- Check if attendance record exists for this user+date
    SELECT id INTO v_existing_id
    FROM attendance
    WHERE user_id = NEW.user_id
      AND date = NEW.attendance_date;

    IF v_existing_id IS NOT NULL THEN
      -- UPDATE existing attendance record
      UPDATE attendance SET
        check_in_time  = COALESCE(NEW.requested_check_in_time::timestamptz, check_in_time),
        check_out_time = COALESCE(NEW.requested_check_out_time::timestamptz, check_out_time),
        status = 'regularized',
        regularized_request_id = NEW.id,
        total_hours = CASE
          WHEN COALESCE(NEW.requested_check_out_time::timestamptz, check_out_time) IS NOT NULL
               AND COALESCE(NEW.requested_check_in_time::timestamptz, check_in_time) IS NOT NULL
          THEN ROUND(
            EXTRACT(EPOCH FROM (
              COALESCE(NEW.requested_check_out_time::timestamptz, check_out_time)
              - COALESCE(NEW.requested_check_in_time::timestamptz, check_in_time)
            )) / 3600.0, 2
          )
          ELSE total_hours
        END,
        updated_at = now()
      WHERE id = v_existing_id;
    ELSE
      -- INSERT new attendance record (absent day being regularized)
      v_check_in  := NEW.requested_check_in_time::timestamptz;
      v_check_out := NEW.requested_check_out_time::timestamptz;

      IF v_check_in IS NOT NULL AND v_check_out IS NOT NULL THEN
        v_total_hours := ROUND(EXTRACT(EPOCH FROM (v_check_out - v_check_in)) / 3600.0, 2);
      ELSE
        v_total_hours := NULL;
      END IF;

      INSERT INTO attendance (
        user_id, date, check_in_time, check_out_time,
        status, regularized_request_id, total_hours
      ) VALUES (
        NEW.user_id, NEW.attendance_date, v_check_in, v_check_out,
        'regularized', NEW.id, v_total_hours
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Trigger on regularization_requests
DROP TRIGGER IF EXISTS trg_apply_regularization_to_attendance ON regularization_requests;
CREATE TRIGGER trg_apply_regularization_to_attendance
  AFTER UPDATE ON regularization_requests
  FOR EACH ROW
  EXECUTE FUNCTION apply_regularization_to_attendance();

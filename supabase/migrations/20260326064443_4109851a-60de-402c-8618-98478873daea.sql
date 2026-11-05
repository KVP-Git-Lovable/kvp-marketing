
CREATE OR REPLACE FUNCTION public.trg_emit_leave_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_name TEXT;
  v_leave_type TEXT;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    SELECT full_name INTO v_user_name FROM profiles WHERE id = NEW.user_id;
    SELECT name INTO v_leave_type FROM leave_types WHERE id = NEW.leave_type_id;

    PERFORM emit_notification_event(
      'RECORD_CREATED',
      'leave_applications',
      NEW.id::TEXT,
      NEW.user_id,
      jsonb_build_object(
        'user_name', COALESCE(v_user_name, 'Unknown'),
        'leave_type', COALESCE(v_leave_type, 'Leave'),
        'from_date', NEW.start_date,
        'to_date', NEW.end_date,
        'total_days', NEW.days_requested,
        'record_name', 'Leave Application'
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

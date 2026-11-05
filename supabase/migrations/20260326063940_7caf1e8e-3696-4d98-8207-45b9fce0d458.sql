
-- 1. Create emit_notification_event RPC (used by edge functions and can be called manually)
CREATE OR REPLACE FUNCTION public.emit_notification_event(
  p_event_code TEXT,
  p_source_table TEXT,
  p_record_id TEXT,
  p_actor_user_id UUID,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO notification_event_log (event_code, source_table, record_id, actor_user_id, metadata, processed)
  VALUES (p_event_code, p_source_table, p_record_id, p_actor_user_id, p_metadata, false)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- 2. Create trigger function: when leave_applications is inserted, emit event
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
        'from_date', NEW.from_date,
        'to_date', NEW.to_date,
        'total_days', NEW.total_days,
        'record_name', 'Leave Application'
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_leave_applied ON leave_applications;
CREATE TRIGGER trg_notify_leave_applied
  AFTER INSERT ON leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION trg_emit_leave_notification();

-- 3. Core processor: match rules and create notifications
CREATE OR REPLACE FUNCTION public.process_notification_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule RECORD;
  v_title TEXT;
  v_message TEXT;
  v_receiver_ids UUID[];
  v_receiver_id UUID;
  v_metadata JSONB;
BEGIN
  v_metadata := COALESCE(NEW.metadata, '{}'::jsonb);

  FOR v_rule IN
    SELECT * FROM notification_rules
    WHERE is_active = true
      AND event_code = NEW.event_code
      AND source_table = NEW.source_table
  LOOP
    v_title := v_rule.title_template;
    v_message := v_rule.message_template;
    
    v_title := replace(v_title, '{user_name}', COALESCE(v_metadata->>'user_name', 'Someone'));
    v_title := replace(v_title, '{record_name}', COALESCE(v_metadata->>'record_name', ''));
    v_title := replace(v_title, '{date}', COALESCE(v_metadata->>'date', ''));
    
    v_message := replace(v_message, '{user_name}', COALESCE(v_metadata->>'user_name', 'Someone'));
    v_message := replace(v_message, '{record_name}', COALESCE(v_metadata->>'record_name', ''));
    v_message := replace(v_message, '{leave_type}', COALESCE(v_metadata->>'leave_type', 'Leave'));
    v_message := replace(v_message, '{from_date}', COALESCE(v_metadata->>'from_date', ''));
    v_message := replace(v_message, '{to_date}', COALESCE(v_metadata->>'to_date', ''));
    v_message := replace(v_message, '{total_days}', COALESCE(v_metadata->>'total_days', ''));
    v_message := replace(v_message, '{date}', COALESCE(v_metadata->>'date', ''));

    v_receiver_ids := ARRAY[]::UUID[];

    IF v_rule.receiver_type = 'manager' OR v_rule.receiver_type = 'employee' THEN
      SELECT ARRAY(
        SELECT manager_id FROM get_reporting_chain(NEW.actor_user_id) WHERE level = 1
      ) INTO v_receiver_ids;

    ELSIF v_rule.receiver_type = 'reporting_chain' THEN
      SELECT ARRAY(
        SELECT manager_id FROM get_reporting_chain(NEW.actor_user_id)
      ) INTO v_receiver_ids;

    ELSIF v_rule.receiver_type = 'specific_user' AND v_rule.receiver_user_id IS NOT NULL THEN
      v_receiver_ids := ARRAY[v_rule.receiver_user_id];

    ELSIF v_rule.receiver_type = 'admin' THEN
      SELECT ARRAY(
        SELECT up.user_id FROM user_profiles up
        JOIN security_profiles sp ON sp.id = up.profile_id
        WHERE sp.name = 'System Administrator'
      ) INTO v_receiver_ids;
    END IF;

    FOREACH v_receiver_id IN ARRAY v_receiver_ids
    LOOP
      IF v_receiver_id IS NOT NULL AND v_receiver_id != NEW.actor_user_id THEN
        INSERT INTO notifications (user_id, title, message, type, related_table, related_id)
        VALUES (v_receiver_id, v_title, v_message, 'info', NEW.source_table, NEW.record_id);
      END IF;
    END LOOP;
  END LOOP;

  UPDATE notification_event_log SET processed = true WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_process_notification ON notification_event_log;
CREATE TRIGGER trg_process_notification
  AFTER INSERT ON notification_event_log
  FOR EACH ROW
  EXECUTE FUNCTION process_notification_event();

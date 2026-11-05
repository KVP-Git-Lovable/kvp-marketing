CREATE OR REPLACE FUNCTION public.process_notification_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_rule RECORD;
  v_title TEXT;
  v_message TEXT;
  v_receiver_ids UUID[];
  v_receiver_id UUID;
  v_metadata JSONB;
  v_related_id UUID;
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
    v_title := replace(v_title, '{auto_close_time}', COALESCE(v_metadata->>'auto_close_time', ''));
    v_title := replace(v_title, '{last_activity}', COALESCE(v_metadata->>'last_activity', ''));

    v_message := replace(v_message, '{user_name}', COALESCE(v_metadata->>'user_name', 'Someone'));
    v_message := replace(v_message, '{record_name}', COALESCE(v_metadata->>'record_name', ''));
    v_message := replace(v_message, '{leave_type}', COALESCE(v_metadata->>'leave_type', 'Leave'));
    v_message := replace(v_message, '{from_date}', COALESCE(v_metadata->>'from_date', ''));
    v_message := replace(v_message, '{to_date}', COALESCE(v_metadata->>'to_date', ''));
    v_message := replace(v_message, '{total_days}', COALESCE(v_metadata->>'total_days', ''));
    v_message := replace(v_message, '{date}', COALESCE(v_metadata->>'date', ''));
    v_message := replace(v_message, '{auto_close_time}', COALESCE(v_metadata->>'auto_close_time', ''));
    v_message := replace(v_message, '{minutes_remaining}', COALESCE(v_metadata->>'minutes_remaining', ''));
    v_message := replace(v_message, '{last_activity}', COALESCE(v_metadata->>'last_activity', ''));

    v_receiver_ids := ARRAY[]::UUID[];

    -- FIXED: 'employee' now correctly sends to the actor, not the manager
    IF v_rule.receiver_type = 'self' OR v_rule.receiver_type = 'employee' THEN
      v_receiver_ids := ARRAY[NEW.actor_user_id];

    ELSIF v_rule.receiver_type = 'manager' THEN
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

    v_related_id := NULL;
    IF NEW.record_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      v_related_id := NEW.record_id::UUID;
    END IF;

    -- FIXED: allow self-notifications for 'self' and 'employee' receiver types
    FOREACH v_receiver_id IN ARRAY v_receiver_ids
    LOOP
      IF v_receiver_id IS NOT NULL AND (
        v_rule.receiver_type IN ('self', 'employee') OR v_receiver_id != NEW.actor_user_id
      ) THEN
        INSERT INTO notifications (user_id, title, message, type, related_table, related_id)
        VALUES (v_receiver_id, v_title, v_message, 'info', NEW.source_table, v_related_id);
      END IF;
    END LOOP;
  END LOOP;

  UPDATE notification_event_log SET processed = true WHERE id = NEW.id;

  RETURN NEW;
END;
$function$;
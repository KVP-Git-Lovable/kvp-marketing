
CREATE OR REPLACE FUNCTION public.emit_notification_event(
  p_event_code text,
  p_source_table text,
  p_record_id text,
  p_actor_user_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_log_id uuid;
  v_rule RECORD;
  v_receiver_id uuid;
  v_title text;
  v_message text;
  v_actor_name text;
  v_module_name text;
  v_record_uuid uuid;
BEGIN
  -- Safely cast record_id to uuid
  BEGIN
    v_record_uuid := p_record_id::uuid;
  EXCEPTION WHEN others THEN
    v_record_uuid := NULL;
  END;

  -- Insert event log
  INSERT INTO notification_event_log (event_code, source_table, record_id, actor_user_id, metadata)
  VALUES (p_event_code, p_source_table, p_record_id, p_actor_user_id, p_metadata)
  RETURNING id INTO v_log_id;

  -- Get actor name
  SELECT COALESCE(full_name, username, 'System') INTO v_actor_name
  FROM profiles WHERE id = p_actor_user_id;

  -- Derive module name from source table
  v_module_name := REPLACE(INITCAP(REPLACE(p_source_table, '_', ' ')), ' ', ' ');

  -- Loop through matching rules
  FOR v_rule IN
    SELECT * FROM notification_rules
    WHERE event_code = p_event_code
      AND source_table = p_source_table
      AND is_active = true
  LOOP
    v_receiver_id := NULL;

    -- Resolve receiver
    CASE v_rule.receiver_type
      WHEN 'employee' THEN
        v_receiver_id := p_actor_user_id;
      WHEN 'manager' THEN
        SELECT manager_id INTO v_receiver_id
        FROM employees WHERE user_id = p_actor_user_id;
      WHEN 'admin' THEN
        FOR v_receiver_id IN
          SELECT up.user_id FROM user_profiles up
          JOIN security_profiles sp ON sp.id = up.profile_id
          WHERE sp.name = 'System Administrator'
        LOOP
          v_title := v_rule.title_template;
          v_message := v_rule.message_template;
          v_title := REPLACE(v_title, '{user_name}', COALESCE(v_actor_name, 'Unknown'));
          v_title := REPLACE(v_title, '{module_name}', v_module_name);
          v_title := REPLACE(v_title, '{record_name}', COALESCE(p_metadata->>'record_name', ''));
          v_title := REPLACE(v_title, '{date}', COALESCE(p_metadata->>'date', TO_CHAR(now(), 'YYYY-MM-DD')));
          v_title := REPLACE(v_title, '{points}', COALESCE(p_metadata->>'points', '0'));
          v_message := REPLACE(v_message, '{user_name}', COALESCE(v_actor_name, 'Unknown'));
          v_message := REPLACE(v_message, '{module_name}', v_module_name);
          v_message := REPLACE(v_message, '{record_name}', COALESCE(p_metadata->>'record_name', ''));
          v_message := REPLACE(v_message, '{date}', COALESCE(p_metadata->>'date', TO_CHAR(now(), 'YYYY-MM-DD')));
          v_message := REPLACE(v_message, '{points}', COALESCE(p_metadata->>'points', '0'));

          INSERT INTO notifications (user_id, title, message, type, related_table, related_id)
          VALUES (v_receiver_id, v_title, v_message, p_event_code, p_source_table, v_record_uuid);
        END LOOP;
        CONTINUE;
      WHEN 'specific_user' THEN
        v_receiver_id := v_rule.receiver_user_id;
      WHEN 'role' THEN
        FOR v_receiver_id IN
          SELECT user_id FROM user_roles WHERE role::text = v_rule.receiver_role
        LOOP
          v_title := v_rule.title_template;
          v_message := v_rule.message_template;
          v_title := REPLACE(v_title, '{user_name}', COALESCE(v_actor_name, 'Unknown'));
          v_title := REPLACE(v_title, '{module_name}', v_module_name);
          v_title := REPLACE(v_title, '{record_name}', COALESCE(p_metadata->>'record_name', ''));
          v_title := REPLACE(v_title, '{date}', COALESCE(p_metadata->>'date', TO_CHAR(now(), 'YYYY-MM-DD')));
          v_title := REPLACE(v_title, '{points}', COALESCE(p_metadata->>'points', '0'));
          v_message := REPLACE(v_message, '{user_name}', COALESCE(v_actor_name, 'Unknown'));
          v_message := REPLACE(v_message, '{module_name}', v_module_name);
          v_message := REPLACE(v_message, '{record_name}', COALESCE(p_metadata->>'record_name', ''));
          v_message := REPLACE(v_message, '{date}', COALESCE(p_metadata->>'date', TO_CHAR(now(), 'YYYY-MM-DD')));
          v_message := REPLACE(v_message, '{points}', COALESCE(p_metadata->>'points', '0'));

          INSERT INTO notifications (user_id, title, message, type, related_table, related_id)
          VALUES (v_receiver_id, v_title, v_message, p_event_code, p_source_table, v_record_uuid);
        END LOOP;
        CONTINUE;
      ELSE
        CONTINUE;
    END CASE;

    IF v_receiver_id IS NOT NULL THEN
      v_title := v_rule.title_template;
      v_message := v_rule.message_template;
      v_title := REPLACE(v_title, '{user_name}', COALESCE(v_actor_name, 'Unknown'));
      v_title := REPLACE(v_title, '{module_name}', v_module_name);
      v_title := REPLACE(v_title, '{record_name}', COALESCE(p_metadata->>'record_name', ''));
      v_title := REPLACE(v_title, '{date}', COALESCE(p_metadata->>'date', TO_CHAR(now(), 'YYYY-MM-DD')));
      v_title := REPLACE(v_title, '{points}', COALESCE(p_metadata->>'points', '0'));
      v_message := REPLACE(v_message, '{user_name}', COALESCE(v_actor_name, 'Unknown'));
      v_message := REPLACE(v_message, '{module_name}', v_module_name);
      v_message := REPLACE(v_message, '{record_name}', COALESCE(p_metadata->>'record_name', ''));
      v_message := REPLACE(v_message, '{date}', COALESCE(p_metadata->>'date', TO_CHAR(now(), 'YYYY-MM-DD')));
      v_message := REPLACE(v_message, '{points}', COALESCE(p_metadata->>'points', '0'));

      INSERT INTO notifications (user_id, title, message, type, related_table, related_id)
      VALUES (v_receiver_id, v_title, v_message, p_event_code, p_source_table, v_record_uuid);
    END IF;
  END LOOP;
END;
$$;

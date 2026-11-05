
-- 1. notification_event_types (reference table)
CREATE TABLE public.notification_event_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code text UNIQUE NOT NULL,
  label text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.notification_event_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read event types"
  ON public.notification_event_types FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage event types"
  ON public.notification_event_types FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed system events
INSERT INTO public.notification_event_types (event_code, label, description) VALUES
  ('RECORD_CREATED', 'Record Created', 'Triggered when a new record is created in any module'),
  ('RECORD_UPDATED', 'Record Updated', 'Triggered when an existing record is updated'),
  ('RECORD_DELETED', 'Record Deleted', 'Triggered when a record is deleted'),
  ('RECORD_APPROVED', 'Record Approved', 'Triggered when a record is approved'),
  ('RECORD_REJECTED', 'Record Rejected', 'Triggered when a record is rejected'),
  ('TASK_ASSIGNED', 'Task Assigned', 'Triggered when a task is assigned to a user'),
  ('ACTIVITY_COMPLETED', 'Activity Completed', 'Triggered when an activity is marked complete'),
  ('TARGET_ACHIEVED', 'Target Achieved', 'Triggered when a target or goal is achieved'),
  ('COMMENT_ADDED', 'Comment Added', 'Triggered when a comment is added to a record'),
  ('FILE_UPLOADED', 'File Uploaded', 'Triggered when a file is uploaded');

-- 2. notification_rules (admin-configurable)
CREATE TABLE public.notification_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  event_code text NOT NULL REFERENCES public.notification_event_types(event_code),
  source_table text NOT NULL,
  receiver_type text NOT NULL DEFAULT 'employee',
  receiver_role text,
  receiver_user_id uuid,
  notification_channel text NOT NULL DEFAULT 'in_app',
  title_template text NOT NULL DEFAULT '{user_name} - {module_name}',
  message_template text NOT NULL DEFAULT '{user_name} performed an action on {module_name}',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active rules"
  ON public.notification_rules FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage rules"
  ON public.notification_rules FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. notification_event_log (audit trail)
CREATE TABLE public.notification_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_code text NOT NULL,
  source_table text NOT NULL,
  record_id text NOT NULL,
  actor_user_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_event_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read event log"
  ON public.notification_event_log FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert event log"
  ON public.notification_event_log FOR INSERT
  TO authenticated WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.notification_event_types TO authenticated, anon;
GRANT ALL ON public.notification_rules TO authenticated, anon;
GRANT ALL ON public.notification_event_log TO authenticated, anon;

-- 4. emit_notification_event() function
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
BEGIN
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
        -- Send to all system admins
        FOR v_receiver_id IN
          SELECT up.user_id FROM user_profiles up
          JOIN security_profiles sp ON sp.id = up.profile_id
          WHERE sp.name = 'System Administrator'
        LOOP
          -- Render templates
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
          VALUES (v_receiver_id, v_title, v_message, p_event_code, p_source_table, p_record_id);
        END LOOP;
        CONTINUE; -- skip the single insert below
      WHEN 'specific_user' THEN
        v_receiver_id := v_rule.receiver_user_id;
      WHEN 'role' THEN
        -- Send to all users with a specific role
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
          VALUES (v_receiver_id, v_title, v_message, p_event_code, p_source_table, p_record_id);
        END LOOP;
        CONTINUE;
      ELSE
        CONTINUE;
    END CASE;

    -- Skip if no receiver resolved
    IF v_receiver_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Render templates for single receiver
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
    VALUES (v_receiver_id, v_title, v_message, p_event_code, p_source_table, p_record_id);
  END LOOP;

  -- Mark event as processed
  UPDATE notification_event_log SET processed = true WHERE id = v_log_id;
END;
$$;

-- 5. DB Triggers on key tables

-- Orders trigger
CREATE OR REPLACE FUNCTION public.trigger_notification_orders()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM emit_notification_event('RECORD_CREATED', 'orders', NEW.id::text, NEW.user_id,
      jsonb_build_object('record_name', COALESCE(NEW.order_number, NEW.id::text), 'date', NEW.order_date::text));
  ELSIF TG_OP = 'UPDATE' AND NEW.status != OLD.status THEN
    IF NEW.status = 'confirmed' THEN
      PERFORM emit_notification_event('RECORD_APPROVED', 'orders', NEW.id::text, NEW.user_id,
        jsonb_build_object('record_name', COALESCE(NEW.order_number, NEW.id::text), 'date', NEW.order_date::text));
    ELSE
      PERFORM emit_notification_event('RECORD_UPDATED', 'orders', NEW.id::text, NEW.user_id,
        jsonb_build_object('record_name', COALESCE(NEW.order_number, NEW.id::text), 'date', NEW.order_date::text));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notification_orders
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION trigger_notification_orders();

-- Leave applications trigger
CREATE OR REPLACE FUNCTION public.trigger_notification_leave_applications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM emit_notification_event('RECORD_CREATED', 'leave_applications', NEW.id::text, NEW.user_id,
      jsonb_build_object('record_name', 'Leave Application', 'date', NEW.start_date::text));
  ELSIF TG_OP = 'UPDATE' AND NEW.status != OLD.status THEN
    IF NEW.status = 'approved' THEN
      PERFORM emit_notification_event('RECORD_APPROVED', 'leave_applications', NEW.id::text, NEW.user_id,
        jsonb_build_object('record_name', 'Leave Application', 'date', NEW.start_date::text));
    ELSIF NEW.status = 'rejected' THEN
      PERFORM emit_notification_event('RECORD_REJECTED', 'leave_applications', NEW.id::text, NEW.user_id,
        jsonb_build_object('record_name', 'Leave Application', 'date', NEW.start_date::text));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notification_leave_applications
  AFTER INSERT OR UPDATE ON public.leave_applications
  FOR EACH ROW EXECUTE FUNCTION trigger_notification_leave_applications();

-- Regularization requests trigger
CREATE OR REPLACE FUNCTION public.trigger_notification_regularization()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM emit_notification_event('RECORD_CREATED', 'regularization_requests', NEW.id::text, NEW.user_id,
      jsonb_build_object('record_name', 'Regularization Request', 'date', NEW.attendance_date::text));
  ELSIF TG_OP = 'UPDATE' AND NEW.status != OLD.status THEN
    IF NEW.status = 'approved' THEN
      PERFORM emit_notification_event('RECORD_APPROVED', 'regularization_requests', NEW.id::text, NEW.user_id,
        jsonb_build_object('record_name', 'Regularization Request', 'date', NEW.attendance_date::text));
    ELSIF NEW.status = 'rejected' THEN
      PERFORM emit_notification_event('RECORD_REJECTED', 'regularization_requests', NEW.id::text, NEW.user_id,
        jsonb_build_object('record_name', 'Regularization Request', 'date', NEW.attendance_date::text));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notification_regularization
  AFTER INSERT OR UPDATE ON public.regularization_requests
  FOR EACH ROW EXECUTE FUNCTION trigger_notification_regularization();

-- Visits trigger
CREATE OR REPLACE FUNCTION public.trigger_notification_visits()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM emit_notification_event('RECORD_CREATED', 'visits', NEW.id::text, NEW.user_id,
      jsonb_build_object('record_name', COALESCE(NEW.retailer_name, 'Visit'), 'date', NEW.planned_date::text));
  ELSIF TG_OP = 'UPDATE' AND NEW.status != OLD.status THEN
    IF NEW.status = 'productive' THEN
      PERFORM emit_notification_event('ACTIVITY_COMPLETED', 'visits', NEW.id::text, NEW.user_id,
        jsonb_build_object('record_name', COALESCE(NEW.retailer_name, 'Visit'), 'date', NEW.planned_date::text));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notification_visits
  AFTER INSERT OR UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION trigger_notification_visits();

-- Activity events trigger
CREATE OR REPLACE FUNCTION public.trigger_notification_activity_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM emit_notification_event('ACTIVITY_COMPLETED', 'activity_events', NEW.id::text, NEW.user_id,
      jsonb_build_object('record_name', COALESCE(NEW.activity_name, NEW.activity_type), 'date', NEW.activity_date::text));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notification_activity_events
  AFTER INSERT ON public.activity_events
  FOR EACH ROW EXECUTE FUNCTION trigger_notification_activity_events();

-- PM Tasks trigger
CREATE OR REPLACE FUNCTION public.trigger_notification_pm_tasks()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM emit_notification_event('TASK_ASSIGNED', 'pm_tasks', NEW.id::text, COALESCE(NEW.assigned_to, NEW.created_by),
      jsonb_build_object('record_name', NEW.title, 'date', NEW.created_at::text));
  ELSIF TG_OP = 'UPDATE' AND NEW.status != OLD.status AND NEW.status = 'done' THEN
    PERFORM emit_notification_event('ACTIVITY_COMPLETED', 'pm_tasks', NEW.id::text, COALESCE(NEW.assigned_to, NEW.created_by),
      jsonb_build_object('record_name', NEW.title, 'date', now()::text));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notification_pm_tasks
  AFTER INSERT OR UPDATE ON public.pm_tasks
  FOR EACH ROW EXECUTE FUNCTION trigger_notification_pm_tasks();

-- Approval requests trigger
CREATE OR REPLACE FUNCTION public.trigger_notification_approval_requests()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status != OLD.status THEN
    IF NEW.status = 'approved' THEN
      PERFORM emit_notification_event('RECORD_APPROVED', 'approval_requests', NEW.id::text, COALESCE(NEW.final_approved_by, NEW.requester_id),
        jsonb_build_object('record_name', NEW.entity_type || ' approval', 'date', now()::text));
    ELSIF NEW.status = 'rejected' THEN
      PERFORM emit_notification_event('RECORD_REJECTED', 'approval_requests', NEW.id::text, NEW.requester_id,
        jsonb_build_object('record_name', NEW.entity_type || ' approval', 'date', now()::text));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notification_approval_requests
  AFTER UPDATE ON public.approval_requests
  FOR EACH ROW EXECUTE FUNCTION trigger_notification_approval_requests();

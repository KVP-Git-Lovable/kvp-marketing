
-- 1. get_reporting_chain: walks employees.manager_id upward
CREATE OR REPLACE FUNCTION public.get_reporting_chain(p_user_id uuid)
RETURNS TABLE(manager_id uuid, level int)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH RECURSIVE chain AS (
    SELECT e.manager_id, 1 AS level
    FROM employees e
    WHERE e.user_id = p_user_id
      AND e.manager_id IS NOT NULL
    UNION ALL
    SELECT e.manager_id, c.level + 1
    FROM chain c
    JOIN employees e ON e.user_id = c.manager_id
    WHERE e.manager_id IS NOT NULL
      AND c.level < 10
  )
  SELECT chain.manager_id, chain.level FROM chain ORDER BY chain.level;
$$;

-- 2. create_approval_request: builds request + steps from chain
CREATE OR REPLACE FUNCTION public.create_approval_request(
  p_entity_type text,
  p_entity_id uuid,
  p_requester_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_request_id uuid;
  v_total_levels int := 0;
  v_max_levels int := 10;
BEGIN
  SELECT ac.max_levels INTO v_max_levels
  FROM approval_config ac
  WHERE ac.entity_type = p_entity_type
  LIMIT 1;
  v_max_levels := COALESCE(v_max_levels, 10);

  SELECT COUNT(*) INTO v_total_levels
  FROM get_reporting_chain(p_requester_id)
  WHERE level <= v_max_levels;

  IF v_total_levels = 0 THEN
    IF p_entity_type = 'leave' THEN
      UPDATE leave_applications SET status = 'approved' WHERE id = p_entity_id;
    ELSIF p_entity_type = 'regularization' THEN
      UPDATE regularization_requests SET status = 'approved', approved_at = now() WHERE id = p_entity_id;
    END IF;
    RETURN NULL;
  END IF;

  INSERT INTO approval_requests (entity_type, entity_id, requester_id, current_level, total_levels, status)
  VALUES (p_entity_type, p_entity_id, p_requester_id, 1, v_total_levels, 'pending')
  RETURNING id INTO v_request_id;

  INSERT INTO approval_steps (approval_request_id, level, approver_id, status)
  SELECT v_request_id, rc.level, rc.manager_id, 'pending'
  FROM get_reporting_chain(p_requester_id) rc
  WHERE rc.level <= v_max_levels;

  INSERT INTO approval_audit_log (approval_request_id, entity_type, entity_id, action, performed_by, level)
  VALUES (v_request_id, p_entity_type, p_entity_id, 'submitted', p_requester_id, 0);

  RETURN v_request_id;
END;
$$;

-- 3. process_approval_step: parallel mode
CREATE OR REPLACE FUNCTION public.process_approval_step(
  p_approval_request_id uuid,
  p_approver_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_step_id uuid;
  v_step_level int;
  v_request RECORD;
BEGIN
  SELECT * INTO v_request FROM approval_requests WHERE id = p_approval_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Approval request not found');
  END IF;
  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Request already processed');
  END IF;

  SELECT id, level INTO v_step_id, v_step_level
  FROM approval_steps
  WHERE approval_request_id = p_approval_request_id
    AND approver_id = p_approver_id
    AND status = 'pending'
  LIMIT 1;

  IF v_step_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No pending step for this approver');
  END IF;

  UPDATE approval_steps
  SET status = p_action,
      action_taken_at = now(),
      rejection_reason = CASE WHEN p_action = 'rejected' THEN p_reason ELSE NULL END
  WHERE id = v_step_id;

  UPDATE approval_steps
  SET status = 'skipped', action_taken_at = now()
  WHERE approval_request_id = p_approval_request_id
    AND id != v_step_id
    AND status = 'pending';

  UPDATE approval_requests
  SET status = p_action,
      current_level = v_step_level,
      final_approved_by = CASE WHEN p_action = 'approved' THEN p_approver_id ELSE NULL END,
      updated_at = now()
  WHERE id = p_approval_request_id;

  INSERT INTO approval_audit_log (approval_request_id, entity_type, entity_id, action, performed_by, level)
  VALUES (p_approval_request_id, v_request.entity_type, v_request.entity_id, p_action, p_approver_id, v_step_level);

  RETURN jsonb_build_object(
    'success', true,
    'is_final', true,
    'action', p_action,
    'next_level', null
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_approval_step(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reporting_chain(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_approval_request(text, uuid, uuid) TO authenticated;

-- 4. Trigger: auto-create approval on leave insert
CREATE OR REPLACE FUNCTION public.trigger_create_leave_approval_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    PERFORM create_approval_request('leave', NEW.id, NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_approval_request ON leave_applications;
CREATE TRIGGER trg_leave_approval_request
  AFTER INSERT ON leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_leave_approval_request();

-- 5. Trigger: auto-create approval on regularization insert
CREATE OR REPLACE FUNCTION public.trigger_create_regularization_approval_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_mode text;
BEGIN
  SELECT approval_mode INTO v_mode FROM regularization_policy LIMIT 1;
  v_mode := COALESCE(v_mode, 'manager');

  IF NEW.status = 'pending' THEN
    IF v_mode = 'auto' THEN
      -- Cannot modify NEW in AFTER trigger, so auto-approve via update
      UPDATE regularization_requests SET status = 'approved', approved_at = now() WHERE id = NEW.id;
    ELSE
      PERFORM create_approval_request('regularization', NEW.id, NEW.user_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_regularization_approval_request ON regularization_requests;
CREATE TRIGGER trg_regularization_approval_request
  AFTER INSERT ON regularization_requests
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_regularization_approval_request();

-- 6. Trigger: sync entity status when approval_request changes
CREATE OR REPLACE FUNCTION public.trigger_sync_entity_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.entity_type = 'leave' THEN
    IF NEW.status = 'approved' THEN
      UPDATE leave_applications
      SET status = 'approved',
          approved_by = NEW.final_approved_by,
          approved_date = now(),
          final_approved_by = NEW.final_approved_by,
          updated_at = now()
      WHERE id = NEW.entity_id;
    ELSIF NEW.status = 'rejected' THEN
      UPDATE leave_applications
      SET status = 'rejected',
          rejection_reason = COALESCE(
            (SELECT rejection_reason FROM approval_steps 
             WHERE approval_request_id = NEW.id AND status = 'rejected' LIMIT 1),
            'Rejected by manager'
          ),
          updated_at = now()
      WHERE id = NEW.entity_id;
    END IF;
  ELSIF NEW.entity_type = 'regularization' THEN
    IF NEW.status = 'approved' THEN
      UPDATE regularization_requests
      SET status = 'approved',
          approved_by = NEW.final_approved_by,
          approved_at = now(),
          updated_at = now()
      WHERE id = NEW.entity_id;
    ELSIF NEW.status = 'rejected' THEN
      UPDATE regularization_requests
      SET status = 'rejected',
          rejection_reason = COALESCE(
            (SELECT rejection_reason FROM approval_steps 
             WHERE approval_request_id = NEW.id AND status = 'rejected' LIMIT 1),
            'Rejected by manager'
          ),
          updated_at = now()
      WHERE id = NEW.entity_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_entity_status ON approval_requests;
CREATE TRIGGER trg_sync_entity_status
  AFTER UPDATE ON approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_entity_status();

-- 7. Seed approval_config for leave and regularization
INSERT INTO approval_config (entity_type, max_levels, use_full_hierarchy, skip_levels)
VALUES 
  ('leave', 10, true, false),
  ('regularization', 10, true, false)
ON CONFLICT DO NOTHING;

-- 8. Backfill orphan pending leaves
DO $$
DECLARE
  v_leave RECORD;
BEGIN
  FOR v_leave IN
    SELECT la.id, la.user_id
    FROM leave_applications la
    WHERE la.status = 'pending'
      AND NOT EXISTS (
        SELECT 1 FROM approval_requests ar 
        WHERE ar.entity_id = la.id AND ar.entity_type = 'leave'
      )
  LOOP
    PERFORM create_approval_request('leave', v_leave.id, v_leave.user_id);
  END LOOP;
END;
$$;

-- Backfill orphan pending regularizations
DO $$
DECLARE
  v_reg RECORD;
  v_mode text;
BEGIN
  SELECT approval_mode INTO v_mode FROM regularization_policy LIMIT 1;
  v_mode := COALESCE(v_mode, 'manager');

  FOR v_reg IN
    SELECT rr.id, rr.user_id
    FROM regularization_requests rr
    WHERE rr.status = 'pending'
      AND NOT EXISTS (
        SELECT 1 FROM approval_requests ar 
        WHERE ar.entity_id = rr.id AND ar.entity_type = 'regularization'
      )
  LOOP
    IF v_mode = 'auto' THEN
      UPDATE regularization_requests SET status = 'approved', approved_at = now() WHERE id = v_reg.id;
    ELSE
      PERFORM create_approval_request('regularization', v_reg.id, v_reg.user_id);
    END IF;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';

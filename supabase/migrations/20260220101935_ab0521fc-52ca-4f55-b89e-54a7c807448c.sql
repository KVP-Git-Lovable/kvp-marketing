
-- =============================================
-- APPROVAL ENGINE - COMPLETE MIGRATION
-- =============================================

-- 1. approval_config: configures how many levels each entity type requires
CREATE TABLE IF NOT EXISTS public.approval_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL UNIQUE,
  use_full_hierarchy boolean NOT NULL DEFAULT true,
  max_levels integer NOT NULL DEFAULT 10,
  final_approval_role text,
  skip_levels boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.approval_config (entity_type, use_full_hierarchy, max_levels)
VALUES 
  ('leave', true, 10),
  ('regularization', true, 10)
ON CONFLICT (entity_type) DO NOTHING;

-- 2. approval_requests: one master record per submitted entity
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  requester_id uuid NOT NULL,
  current_level integer NOT NULL DEFAULT 1,
  total_levels integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  final_approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_entity ON public.approval_requests(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_requester ON public.approval_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON public.approval_requests(status);

-- 3. approval_steps: one row per level per request
CREATE TABLE IF NOT EXISTS public.approval_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id uuid NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  level integer NOT NULL,
  approver_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  action_taken_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_steps_request ON public.approval_steps(approval_request_id);
CREATE INDEX IF NOT EXISTS idx_approval_steps_approver ON public.approval_steps(approver_id, status);

-- 4. approval_audit_log: immutable event log
CREATE TABLE IF NOT EXISTS public.approval_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id uuid REFERENCES public.approval_requests(id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  performed_by uuid NOT NULL,
  level integer,
  timestamp timestamptz NOT NULL DEFAULT now(),
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS idx_approval_audit_request ON public.approval_audit_log(approval_request_id);
CREATE INDEX IF NOT EXISTS idx_approval_audit_entity ON public.approval_audit_log(entity_type, entity_id);

-- 5. Add locked fields to attendance for payroll protection
ALTER TABLE public.attendance 
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by uuid;

-- =============================================
-- DB FUNCTIONS
-- =============================================

-- get_reporting_chain: upward traversal from employee → managers
CREATE OR REPLACE FUNCTION public.get_reporting_chain(p_user_id uuid)
RETURNS TABLE(manager_id uuid, level integer, full_name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE chain AS (
    SELECT e.manager_id, 1 AS lvl
    FROM employees e
    WHERE e.user_id = p_user_id
      AND e.manager_id IS NOT NULL

    UNION ALL

    SELECT e.manager_id, c.lvl + 1
    FROM employees e
    INNER JOIN chain c ON e.user_id = c.manager_id
    WHERE e.manager_id IS NOT NULL
      AND c.lvl < 10
  )
  SELECT 
    c.manager_id,
    c.lvl as level,
    COALESCE(p.full_name, p.username, 'Unknown') as full_name
  FROM chain c
  LEFT JOIN profiles p ON p.id = c.manager_id
  ORDER BY c.lvl;
END;
$$;

-- create_approval_request: called on entity insert to build the workflow
CREATE OR REPLACE FUNCTION public.create_approval_request(
  p_entity_type text,
  p_entity_id uuid,
  p_requester_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chain RECORD;
  v_config RECORD;
  v_request_id uuid;
  v_levels integer := 0;
BEGIN
  -- Get config for this entity type
  SELECT * INTO v_config 
  FROM approval_config 
  WHERE entity_type = p_entity_type;

  -- Count levels from reporting chain
  FOR v_chain IN 
    SELECT manager_id, level 
    FROM get_reporting_chain(p_requester_id)
    ORDER BY level
    LIMIT COALESCE(v_config.max_levels, 10)
  LOOP
    v_levels := v_levels + 1;
  END LOOP;

  -- If no chain, use 1 level (admin must approve)
  IF v_levels = 0 THEN
    v_levels := 1;
  END IF;

  -- Create master request
  INSERT INTO approval_requests (entity_type, entity_id, requester_id, current_level, total_levels, status)
  VALUES (p_entity_type, p_entity_id, p_requester_id, 1, v_levels, 'pending')
  RETURNING id INTO v_request_id;

  -- Create a step for each manager in chain
  FOR v_chain IN 
    SELECT manager_id, level 
    FROM get_reporting_chain(p_requester_id)
    ORDER BY level
    LIMIT COALESCE(v_config.max_levels, 10)
  LOOP
    INSERT INTO approval_steps (approval_request_id, level, approver_id, status)
    VALUES (v_request_id, v_chain.level, v_chain.manager_id, 'pending');
  END LOOP;

  -- Log submission event
  INSERT INTO approval_audit_log (approval_request_id, entity_type, entity_id, action, performed_by, level, metadata)
  VALUES (v_request_id, p_entity_type, p_entity_id, 'submitted', p_requester_id, 0, 
          jsonb_build_object('total_levels', v_levels));

  RETURN v_request_id;
END;
$$;

-- process_approval_step: called when a manager approves/rejects
CREATE OR REPLACE FUNCTION public.process_approval_step(
  p_approval_request_id uuid,
  p_approver_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_step RECORD;
  v_next_level integer;
  v_is_final boolean := false;
BEGIN
  SELECT * INTO v_request FROM approval_requests WHERE id = p_approval_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Request not found');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Request already processed');
  END IF;

  -- Find the step for this approver at the current level
  SELECT * INTO v_step FROM approval_steps 
  WHERE approval_request_id = p_approval_request_id
    AND level = v_request.current_level
    AND approver_id = p_approver_id
    AND status = 'pending';

  -- If no exact step found, check if this approver has ANY pending step (allows admins to approve at any level)
  IF NOT FOUND THEN
    SELECT * INTO v_step FROM approval_steps 
    WHERE approval_request_id = p_approval_request_id
      AND approver_id = p_approver_id
      AND status = 'pending'
    ORDER BY level ASC
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    -- Allow admin bypass: if no step exists for this approver, check if they're an admin acting directly
    RETURN jsonb_build_object('success', false, 'message', 'No pending step found for this approver at current level');
  END IF;

  -- Update the step
  UPDATE approval_steps SET
    status = p_action,
    action_taken_at = now(),
    rejection_reason = p_reason
  WHERE id = v_step.id;

  -- Log action
  INSERT INTO approval_audit_log (approval_request_id, entity_type, entity_id, action, performed_by, level, metadata)
  VALUES (p_approval_request_id, v_request.entity_type, v_request.entity_id, p_action, p_approver_id, 
          v_step.level, jsonb_build_object('reason', p_reason));

  IF p_action = 'rejected' THEN
    UPDATE approval_requests SET status = 'rejected', updated_at = now() WHERE id = p_approval_request_id;
    RETURN jsonb_build_object('success', true, 'message', 'Request rejected', 'is_final', true, 'action', 'rejected');
  END IF;

  v_next_level := v_step.level + 1;
  v_is_final := v_next_level > v_request.total_levels;

  IF v_is_final THEN
    UPDATE approval_requests SET
      status = 'approved',
      current_level = v_next_level,
      final_approved_by = p_approver_id,
      updated_at = now()
    WHERE id = p_approval_request_id;

    RETURN jsonb_build_object('success', true, 'message', 'Finally approved', 'is_final', true, 'action', 'approved');
  ELSE
    UPDATE approval_requests SET
      current_level = v_next_level,
      updated_at = now()
    WHERE id = p_approval_request_id;

    RETURN jsonb_build_object('success', true, 'message', 'Forwarded to next level', 'is_final', false, 'next_level', v_next_level, 'action', 'approved');
  END IF;
END;
$$;

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_config ENABLE ROW LEVEL SECURITY;

-- approval_requests policies
CREATE POLICY "Users can view their own approval requests"
ON public.approval_requests FOR SELECT
USING (requester_id = auth.uid());

CREATE POLICY "Approvers can view requests at their step"
ON public.approval_requests FOR SELECT
USING (EXISTS (
  SELECT 1 FROM approval_steps s
  WHERE s.approval_request_id = approval_requests.id
    AND s.approver_id = auth.uid()
));

CREATE POLICY "Users can insert approval requests"
ON public.approval_requests FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Service can update approval requests"
ON public.approval_requests FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- approval_steps policies
CREATE POLICY "Approvers can view their own steps"
ON public.approval_steps FOR SELECT
USING (approver_id = auth.uid());

CREATE POLICY "Requesters can view their steps"
ON public.approval_steps FOR SELECT
USING (EXISTS (
  SELECT 1 FROM approval_requests ar
  WHERE ar.id = approval_steps.approval_request_id
    AND ar.requester_id = auth.uid()
));

CREATE POLICY "Service can manage steps"
ON public.approval_steps FOR ALL
USING (auth.uid() IS NOT NULL);

-- audit log policies
CREATE POLICY "Users can view own audit logs"
ON public.approval_audit_log FOR SELECT
USING (
  performed_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM approval_requests ar
    WHERE ar.id = approval_audit_log.approval_request_id 
      AND ar.requester_id = auth.uid()
  )
);

CREATE POLICY "Approvers can view audit for their steps"
ON public.approval_audit_log FOR SELECT
USING (EXISTS (
  SELECT 1 FROM approval_steps ast
  WHERE ast.approval_request_id = approval_audit_log.approval_request_id
    AND ast.approver_id = auth.uid()
));

CREATE POLICY "Service can insert audit logs"
ON public.approval_audit_log FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- approval_config policies
CREATE POLICY "Authenticated can read config"
ON public.approval_config FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage config"
ON public.approval_config FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger function: auto-create approval request for leave
CREATE OR REPLACE FUNCTION public.trigger_create_leave_approval_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM create_approval_request('leave', NEW.id, NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_approval_request ON public.leave_applications;
CREATE TRIGGER trg_leave_approval_request
AFTER INSERT ON public.leave_applications
FOR EACH ROW EXECUTE FUNCTION trigger_create_leave_approval_request();

-- Trigger function: auto-create approval request for regularization
CREATE OR REPLACE FUNCTION public.trigger_create_regularization_approval_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM create_approval_request('regularization', NEW.id, NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_regularization_approval_request ON public.regularization_requests;
CREATE TRIGGER trg_regularization_approval_request
AFTER INSERT ON public.regularization_requests
FOR EACH ROW EXECUTE FUNCTION trigger_create_regularization_approval_request();

-- Trigger function: sync approval_requests status back to entity tables
CREATE OR REPLACE FUNCTION public.trigger_sync_entity_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    IF NEW.entity_type = 'leave' THEN
      UPDATE leave_applications SET 
        status = 'approved', 
        approved_by = NEW.final_approved_by, 
        approved_date = now(),
        final_approved_by = NEW.final_approved_by
      WHERE id = NEW.entity_id;
    ELSIF NEW.entity_type = 'regularization' THEN
      UPDATE regularization_requests SET 
        status = 'approved', 
        approved_by = NEW.final_approved_by, 
        approved_at = now()
      WHERE id = NEW.entity_id;
    END IF;
  ELSIF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
    IF NEW.entity_type = 'leave' THEN
      UPDATE leave_applications SET status = 'rejected' WHERE id = NEW.entity_id;
    ELSIF NEW.entity_type = 'regularization' THEN
      UPDATE regularization_requests SET status = 'rejected' WHERE id = NEW.entity_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_entity_status ON public.approval_requests;
CREATE TRIGGER trg_sync_entity_status
AFTER UPDATE ON public.approval_requests
FOR EACH ROW EXECUTE FUNCTION trigger_sync_entity_status();

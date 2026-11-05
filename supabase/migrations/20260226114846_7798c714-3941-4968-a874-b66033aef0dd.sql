-- Update process_approval_step to parallel approval: any approver can act, result is always final
CREATE OR REPLACE FUNCTION public.process_approval_step(p_approval_request_id uuid, p_approver_id uuid, p_action text, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_request RECORD;
  v_step RECORD;
BEGIN
  SELECT * INTO v_request FROM approval_requests WHERE id = p_approval_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Request not found');
  END IF;

  IF v_request.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Request already processed');
  END IF;

  -- Find ANY pending step for this approver (parallel: no level check)
  SELECT * INTO v_step FROM approval_steps 
  WHERE approval_request_id = p_approval_request_id
    AND approver_id = p_approver_id
    AND status = 'pending'
  ORDER BY level ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'No pending step found for this approver');
  END IF;

  -- Update the acting step
  UPDATE approval_steps SET
    status = p_action,
    action_taken_at = now(),
    rejection_reason = p_reason
  WHERE id = v_step.id;

  -- Skip all other pending steps
  UPDATE approval_steps SET
    status = 'skipped',
    action_taken_at = now()
  WHERE approval_request_id = p_approval_request_id
    AND id != v_step.id
    AND status = 'pending';

  -- Log action
  INSERT INTO approval_audit_log (approval_request_id, entity_type, entity_id, action, performed_by, level, metadata)
  VALUES (p_approval_request_id, v_request.entity_type, v_request.entity_id, p_action, p_approver_id, 
          v_step.level, jsonb_build_object('reason', p_reason));

  IF p_action = 'rejected' THEN
    UPDATE approval_requests SET status = 'rejected', updated_at = now() WHERE id = p_approval_request_id;
    RETURN jsonb_build_object('success', true, 'message', 'Request rejected', 'is_final', true, 'action', 'rejected');
  END IF;

  -- Approved: always final in parallel mode
  UPDATE approval_requests SET
    status = 'approved',
    final_approved_by = p_approver_id,
    updated_at = now()
  WHERE id = p_approval_request_id;

  RETURN jsonb_build_object('success', true, 'message', 'Request approved', 'is_final', true, 'action', 'approved');
END;
$function$;
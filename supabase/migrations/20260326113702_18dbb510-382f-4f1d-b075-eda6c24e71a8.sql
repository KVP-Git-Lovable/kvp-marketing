-- Helper: Check if user is an approver on any step for a given request
CREATE OR REPLACE FUNCTION public.is_step_approver(p_request_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM approval_steps WHERE approval_request_id = p_request_id AND approver_id = p_user_id
  );
$$;

-- Helper: Check if user is the requester of a given approval request
CREATE OR REPLACE FUNCTION public.is_request_participant(p_step_request_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM approval_requests WHERE id = p_step_request_id AND requester_id = p_user_id
  );
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION public.is_step_approver(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_request_participant(uuid, uuid) TO authenticated;

-- Replace recursive RLS policy on approval_requests
DROP POLICY IF EXISTS "Approvers can view requests at their step" ON approval_requests;
CREATE POLICY "Approvers can view requests at their step" ON approval_requests
  FOR SELECT USING (public.is_step_approver(id, auth.uid()));

-- Replace recursive RLS policy on approval_steps
DROP POLICY IF EXISTS "Requesters can view their steps" ON approval_steps;
CREATE POLICY "Requesters can view their steps" ON approval_steps
  FOR SELECT USING (public.is_request_participant(approval_request_id, auth.uid()));
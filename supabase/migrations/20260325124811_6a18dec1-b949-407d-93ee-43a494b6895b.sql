-- Fix infinite RLS recursion between approval_requests and approval_steps

-- 1. Create SECURITY DEFINER helper functions to break the cycle

CREATE OR REPLACE FUNCTION public.is_approver_for_request(p_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM approval_steps
    WHERE approval_request_id = p_request_id
      AND approver_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_requester_for_step(p_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM approval_requests
    WHERE id = p_request_id
      AND requester_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_requester_for_audit(p_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM approval_requests
    WHERE id = p_request_id
      AND requester_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_approver_for_audit(p_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM approval_steps
    WHERE approval_request_id = p_request_id
      AND approver_id = auth.uid()
  );
$$;

-- 2. Drop recursive policies

DROP POLICY IF EXISTS "Approvers can view requests at their step" ON approval_requests;
DROP POLICY IF EXISTS "Requesters can view their steps" ON approval_steps;
DROP POLICY IF EXISTS "Users can view own audit logs" ON approval_audit_log;
DROP POLICY IF EXISTS "Approvers can view audit for their steps" ON approval_audit_log;

-- 3. Recreate policies using helper functions (no cross-table subqueries = no recursion)

CREATE POLICY "Approvers can view requests at their step"
  ON approval_requests FOR SELECT
  USING (is_approver_for_request(id));

CREATE POLICY "Requesters can view their steps"
  ON approval_steps FOR SELECT
  USING (is_requester_for_step(approval_request_id));

CREATE POLICY "Users can view own audit logs"
  ON approval_audit_log FOR SELECT
  USING (performed_by = auth.uid() OR is_requester_for_audit(approval_request_id));

CREATE POLICY "Approvers can view audit for their steps"
  ON approval_audit_log FOR SELECT
  USING (is_approver_for_audit(approval_request_id));

NOTIFY pgrst, 'reload schema';
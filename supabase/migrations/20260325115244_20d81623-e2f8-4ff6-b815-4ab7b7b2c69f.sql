-- Replicate staging RLS policies for approval tables exactly

-- approval_requests (4 policies)
DROP POLICY IF EXISTS "Users can view their own approval requests" ON public.approval_requests;
CREATE POLICY "Users can view their own approval requests"
  ON public.approval_requests FOR SELECT
  USING (requester_id = auth.uid());

DROP POLICY IF EXISTS "Approvers can view requests at their step" ON public.approval_requests;
CREATE POLICY "Approvers can view requests at their step"
  ON public.approval_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.approval_steps s
      WHERE s.approval_request_id = id
        AND s.approver_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert approval requests" ON public.approval_requests;
CREATE POLICY "Users can insert approval requests"
  ON public.approval_requests FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Service can update approval requests" ON public.approval_requests;
CREATE POLICY "Service can update approval requests"
  ON public.approval_requests FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- approval_steps (3 policies)
DROP POLICY IF EXISTS "Approvers can view their own steps" ON public.approval_steps;
CREATE POLICY "Approvers can view their own steps"
  ON public.approval_steps FOR SELECT
  USING (approver_id = auth.uid());

DROP POLICY IF EXISTS "Requesters can view their steps" ON public.approval_steps;
CREATE POLICY "Requesters can view their steps"
  ON public.approval_steps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.approval_requests r
      WHERE r.id = approval_request_id
        AND r.requester_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service can manage steps" ON public.approval_steps;
CREATE POLICY "Service can manage steps"
  ON public.approval_steps FOR ALL
  USING (auth.uid() IS NOT NULL);

-- approval_audit_log (3 policies)
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.approval_audit_log;
CREATE POLICY "Users can view own audit logs"
  ON public.approval_audit_log FOR SELECT
  USING (
    performed_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.approval_requests r
      WHERE r.id = approval_request_id
        AND r.requester_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Approvers can view audit for their steps" ON public.approval_audit_log;
CREATE POLICY "Approvers can view audit for their steps"
  ON public.approval_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.approval_steps s
      WHERE s.approval_request_id = approval_request_id
        AND s.approver_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service can insert audit logs" ON public.approval_audit_log;
CREATE POLICY "Service can insert audit logs"
  ON public.approval_audit_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- approval_config (2 policies)
DROP POLICY IF EXISTS "Authenticated can read config" ON public.approval_config;
CREATE POLICY "Authenticated can read config"
  ON public.approval_config FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage config" ON public.approval_config;
CREATE POLICY "Admins can manage config"
  ON public.approval_config FOR ALL
  USING (public.is_system_admin(auth.uid()));

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
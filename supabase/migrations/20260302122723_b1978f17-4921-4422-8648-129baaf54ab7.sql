-- Create beat_audit_log table for tracking all beat mutations
CREATE TABLE public.beat_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beat_id text NOT NULL,
  action text NOT NULL,
  old_user_id uuid,
  new_user_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  performed_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.beat_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert audit logs"
  ON public.beat_audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = performed_by);

CREATE POLICY "Users can view own audit logs"
  ON public.beat_audit_log FOR SELECT TO authenticated
  USING (
    performed_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

GRANT ALL ON public.beat_audit_log TO authenticated;
GRANT ALL ON public.beat_audit_log TO anon;
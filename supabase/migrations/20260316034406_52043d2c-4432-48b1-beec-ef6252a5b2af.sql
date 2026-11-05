
CREATE TABLE public.module_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  module_category TEXT NOT NULL DEFAULT 'core',
  route_path TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_module_usage_user_date ON public.module_usage_logs (user_id, started_at);
CREATE INDEX idx_module_usage_module ON public.module_usage_logs (module_name);

ALTER TABLE public.module_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own usage logs"
ON public.module_usage_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own usage logs"
ON public.module_usage_logs FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins and managers can view all usage logs"
ON public.module_usage_logs FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR public.has_role(auth.uid(), 'admin')
  OR user_id IN (
    SELECT s.subordinate_user_id FROM public.get_all_subordinates(auth.uid()) s
  )
);

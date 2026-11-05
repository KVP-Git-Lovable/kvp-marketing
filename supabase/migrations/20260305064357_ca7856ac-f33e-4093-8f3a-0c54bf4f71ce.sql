
-- Fix: allow authenticated users to manage leave_policy (matching project's permissive DB pattern)
DROP POLICY IF EXISTS "Admins can manage leave policies" ON public.leave_policy;
CREATE POLICY "Authenticated users can manage leave policies"
  ON public.leave_policy
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

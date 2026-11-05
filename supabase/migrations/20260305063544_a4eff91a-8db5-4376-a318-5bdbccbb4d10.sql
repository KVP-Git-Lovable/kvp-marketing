
-- Fix RLS policy for leave_policy table to allow admin inserts/updates
DROP POLICY IF EXISTS "Admins can manage leave policies" ON public.leave_policy;
CREATE POLICY "Admins can manage leave policies"
  ON public.leave_policy
  FOR ALL
  TO authenticated
  USING (is_admin_or_manager())
  WITH CHECK (is_admin_or_manager());


-- Add manager RLS policies to leave_applications table

-- Policy 1: Managers can SELECT their direct reports' leave applications
CREATE POLICY "Managers can view their direct reports' leave applications"
  ON public.leave_applications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = leave_applications.user_id
        AND e.manager_id = auth.uid()
    )
  );

-- Policy 2: Managers can UPDATE (approve/reject) their direct reports' leave applications
CREATE POLICY "Managers can update their direct reports' leave applications"
  ON public.leave_applications
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = leave_applications.user_id
        AND e.manager_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = leave_applications.user_id
        AND e.manager_id = auth.uid()
    )
  );

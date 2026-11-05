-- Allow admins to view all leave applications
CREATE POLICY "Admins can view all leave applications"
  ON public.leave_applications
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update any leave application (approve/reject)
CREATE POLICY "Admins can update leave applications"
  ON public.leave_applications
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
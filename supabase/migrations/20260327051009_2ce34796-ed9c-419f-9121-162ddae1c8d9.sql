-- Add admin read policy to employees table
DROP POLICY IF EXISTS "Admins can view all employees" ON public.employees;
CREATE POLICY "Admins can view all employees"
  ON public.employees FOR SELECT
  TO authenticated
  USING (public.is_system_admin(auth.uid()));
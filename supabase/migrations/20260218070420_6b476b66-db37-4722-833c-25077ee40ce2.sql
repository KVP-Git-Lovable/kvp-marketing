-- Add missing admin RLS policies for leave_balance table
-- Currently only has SELECT for own records — admins cannot INSERT or UPDATE

-- Admin SELECT: view all balances
CREATE POLICY "Admins can view all leave balances"
  ON public.leave_balance
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admin INSERT: create balances for any user
CREATE POLICY "Admins can insert leave balances"
  ON public.leave_balance
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admin UPDATE: modify any user's balance
CREATE POLICY "Admins can update leave balances"
  ON public.leave_balance
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admin DELETE: remove balance records if needed
CREATE POLICY "Admins can delete leave balances"
  ON public.leave_balance
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
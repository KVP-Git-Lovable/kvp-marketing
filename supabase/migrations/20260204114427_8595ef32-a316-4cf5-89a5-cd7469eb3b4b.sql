-- Add RLS policies for leave_types table to allow admin CRUD operations

-- Policy for admins to insert leave types
CREATE POLICY "Admins can insert leave types"
  ON leave_types
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_system_admin(auth.uid()));

-- Policy for admins to update leave types
CREATE POLICY "Admins can update leave types"
  ON leave_types
  FOR UPDATE
  TO authenticated
  USING (public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()));

-- Policy for admins to delete leave types
CREATE POLICY "Admins can delete leave types"
  ON leave_types
  FOR DELETE
  TO authenticated
  USING (public.is_system_admin(auth.uid()));
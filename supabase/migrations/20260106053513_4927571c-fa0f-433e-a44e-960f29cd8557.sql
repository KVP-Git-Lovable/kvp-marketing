-- Fix 1: Remove insecure distributor_inventory policy
DROP POLICY IF EXISTS "Distributors can view their inventory" ON public.distributor_inventory;

-- Create secure policy for distributor inventory
CREATE POLICY "Distributors can view their inventory"
  ON public.distributor_inventory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.distributor_users du 
      WHERE du.auth_user_id = auth.uid()
      AND du.distributor_id = distributor_inventory.distributor_id
      AND du.is_active = true
    ) OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Fix 2: Remove unrestricted notification policy
DROP POLICY IF EXISTS "All users can create any notification" ON public.notifications;

-- Create secure policy - only admins and service role can create notifications
CREATE POLICY "Admins can create notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can only create notifications for themselves (for system-generated personal notifications)
CREATE POLICY "Users can create own notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
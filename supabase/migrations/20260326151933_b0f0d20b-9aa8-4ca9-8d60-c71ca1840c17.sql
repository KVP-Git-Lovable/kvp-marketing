-- Fix: order_items has RLS enabled but no SELECT policies
-- Users can read items belonging to their own orders
CREATE POLICY "Users can read own order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    order_id IN (SELECT id FROM orders WHERE user_id = auth.uid())
  );

-- Admins can read all order items
CREATE POLICY "Admins can read all order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (public.is_system_admin(auth.uid()));
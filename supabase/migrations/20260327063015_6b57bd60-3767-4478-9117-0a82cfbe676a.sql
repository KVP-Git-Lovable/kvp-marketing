-- Add admin SELECT policy on orders table
CREATE POLICY "Admins can view all orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (public.is_system_admin(auth.uid()));

-- Add manager SELECT policy on orders table  
CREATE POLICY "Managers can view subordinate orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT subordinate_user_id 
      FROM public.get_all_subordinates(auth.uid())
    )
  );
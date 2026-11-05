-- Allow authenticated users to insert their own orders
CREATE POLICY "Users can insert their own orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow admins to insert any order (mirror existing admin read/update policies)
CREATE POLICY "Admins can insert all orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (public.is_system_admin(auth.uid()));

-- Allow authenticated users to insert items for orders they own
CREATE POLICY "Users can insert items for their own orders"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.user_id = auth.uid()
  )
);
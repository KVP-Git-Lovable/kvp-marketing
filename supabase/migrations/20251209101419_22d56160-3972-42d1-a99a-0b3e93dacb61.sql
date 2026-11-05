-- Add admin UPDATE policy for orders table
CREATE POLICY "Admins can update all orders"
ON public.orders
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add admin ALL policy for order_items table (allows INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can manage all order items"
ON public.order_items
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
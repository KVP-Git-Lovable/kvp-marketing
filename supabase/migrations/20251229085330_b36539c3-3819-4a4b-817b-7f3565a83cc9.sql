-- Allow authenticated users to view all orders for reporting purposes
CREATE POLICY "Authenticated users can view orders for reporting"
ON public.orders
FOR SELECT
USING (auth.role() = 'authenticated');
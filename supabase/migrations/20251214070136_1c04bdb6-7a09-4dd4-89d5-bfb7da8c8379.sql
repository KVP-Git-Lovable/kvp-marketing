-- Add policy to allow users to view all orders for retailers they have access to
-- This enables normal users to see all invoices for a retailer in the retailer detail modal

CREATE POLICY "Users can view orders for accessible retailers"
ON public.orders
FOR SELECT
USING (
  retailer_id IN (
    SELECT id FROM public.retailers 
    WHERE user_id = auth.uid()
  )
);
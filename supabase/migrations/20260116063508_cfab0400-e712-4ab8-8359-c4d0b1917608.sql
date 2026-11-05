-- Allow distributor portal users to update orders for their distributor
CREATE POLICY "Distributor users can update orders for their distributor"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM distributor_users du
    WHERE du.auth_user_id = auth.uid()
      AND du.distributor_id = orders.distributor_id
      AND du.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM distributor_users du
    WHERE du.auth_user_id = auth.uid()
      AND du.distributor_id = orders.distributor_id
      AND du.is_active = true
  )
);
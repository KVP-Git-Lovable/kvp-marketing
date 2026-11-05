-- Fix RLS policies for distributor_inventory to allow admin inserts

-- Drop the existing policy that has no WITH CHECK clause
DROP POLICY IF EXISTS "Distributors can manage their inventory" ON public.distributor_inventory;

-- Create proper INSERT policy for admins
CREATE POLICY "Admins can insert inventory"
ON public.distributor_inventory
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create proper UPDATE policy for admins  
CREATE POLICY "Admins can update inventory"
ON public.distributor_inventory
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create proper DELETE policy for admins
CREATE POLICY "Admins can delete inventory"
ON public.distributor_inventory
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Recreate distributor user management policy with proper WITH CHECK
CREATE POLICY "Distributor users can manage their inventory"
ON public.distributor_inventory
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM distributor_users du
    WHERE du.auth_user_id = auth.uid()
      AND du.distributor_id = distributor_inventory.distributor_id
      AND du.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM distributor_users du
    WHERE du.auth_user_id = auth.uid()
      AND du.distributor_id = distributor_inventory.distributor_id
      AND du.is_active = true
  )
);
-- Fix vendors table security vulnerability
-- Remove the policy that exposes sensitive contact information to all users
DROP POLICY IF EXISTS "Users can view non-sensitive vendor info" ON public.vendors;

-- Only admins can directly query the vendors table
-- Regular users must use the get_public_vendors() or get_vendors_public_info() 
-- RPC functions which exclude sensitive contact information
CREATE POLICY "Only admins can view vendor data directly"
ON public.vendors
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
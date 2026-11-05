-- Add RLS policy for admins to view all visits
CREATE POLICY "Admins can view all visits"
ON public.visits
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add RLS policy for admins to view all attendance records
CREATE POLICY "Admins can view all attendance"
ON public.attendance
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add RLS policy for admins to view all orders
CREATE POLICY "Admins can view all orders"
ON public.orders
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add RLS policy for admins to view all stock records
CREATE POLICY "Admins can view all stock"
ON public.stock
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add RLS policy for admins to view all retailers
CREATE POLICY "Admins can view all retailers"
ON public.retailers
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));
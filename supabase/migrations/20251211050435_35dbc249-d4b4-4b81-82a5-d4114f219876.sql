-- Drop existing policies and create proper ones for distributor_users
DROP POLICY IF EXISTS "Authenticated users can insert distributor users" ON public.distributor_users;
DROP POLICY IF EXISTS "Authenticated users can view distributor users" ON public.distributor_users;
DROP POLICY IF EXISTS "Authenticated users can update distributor users" ON public.distributor_users;
DROP POLICY IF EXISTS "Authenticated users can delete distributor users" ON public.distributor_users;

-- Create proper RLS policies for distributor_users
CREATE POLICY "Authenticated users can insert distributor users" 
ON public.distributor_users 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view distributor users" 
ON public.distributor_users 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update distributor users" 
ON public.distributor_users 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete distributor users" 
ON public.distributor_users 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));
-- Add RLS policies for vendors (Super Stockists) table
CREATE POLICY "Authenticated users can insert vendors" 
ON public.vendors 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update vendors" 
ON public.vendors 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete vendors" 
ON public.vendors 
FOR DELETE 
TO authenticated
USING (true);

-- Add RLS policies for distributors table (for non-admin users)
CREATE POLICY "Authenticated users can insert distributors" 
ON public.distributors 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update distributors" 
ON public.distributors 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete distributors" 
ON public.distributors 
FOR DELETE 
TO authenticated
USING (true);

-- Also ensure distributors table allows all authenticated users to view
DROP POLICY IF EXISTS "Users can view basic distributor info (no financial data)" ON public.distributors;

CREATE POLICY "Authenticated users can view all distributors" 
ON public.distributors 
FOR SELECT 
TO authenticated
USING (true);
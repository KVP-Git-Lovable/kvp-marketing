CREATE POLICY "Authenticated users can read retailer_external_unsorted"
ON public.retailer_external_unsorted
FOR SELECT
TO authenticated
USING (true);
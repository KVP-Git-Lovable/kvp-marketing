-- Add RLS policy to allow authenticated users to read all retailers for analytics
CREATE POLICY "Authenticated users can view all retailers for analytics"
ON public.retailers
FOR SELECT
TO authenticated
USING (true);
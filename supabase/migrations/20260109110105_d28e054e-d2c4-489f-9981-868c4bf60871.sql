-- Add RLS policy to allow authenticated users to read all beats for analytics
CREATE POLICY "Authenticated users can view all beats for analytics"
ON public.beats
FOR SELECT
TO authenticated
USING (true);
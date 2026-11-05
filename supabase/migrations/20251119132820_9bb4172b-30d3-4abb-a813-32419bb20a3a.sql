-- Add RLS policy to allow users to view retailers they have visits for
-- This fixes the issue where retailer data shows as "Unknown Retailer" in reports

CREATE POLICY "Users can view retailers they have visits for"
ON public.retailers
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 
    FROM public.visits v 
    WHERE v.retailer_id = retailers.id 
      AND v.user_id = auth.uid()
  )
);
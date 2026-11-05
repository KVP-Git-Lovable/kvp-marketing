-- Create function to check for duplicate competitors
CREATE OR REPLACE FUNCTION public.check_duplicate_competitor(
  competitor_name_param TEXT
)
RETURNS TABLE(
  is_duplicate BOOLEAN,
  competitor_id UUID,
  competitor_name TEXT,
  competitor_image_url TEXT,
  product_details TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    TRUE as is_duplicate,
    ci.id as competitor_id,
    ci.competitor_name,
    ci.competitor_image_url,
    ci.product_details
  FROM public.competition_insights ci
  WHERE LOWER(TRIM(ci.competitor_name)) = LOWER(TRIM(competitor_name_param))
  LIMIT 1;
$$;

-- Create index for faster competitor name lookups
CREATE INDEX IF NOT EXISTS idx_competition_insights_competitor_name 
ON public.competition_insights (LOWER(competitor_name));
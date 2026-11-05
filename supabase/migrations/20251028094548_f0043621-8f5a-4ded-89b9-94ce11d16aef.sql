-- Add assigned user and zone fields to territories table
ALTER TABLE public.territories 
ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS zone text;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_territories_assigned_user ON public.territories(assigned_user_id);

-- Create a function to get territory sales summary
CREATE OR REPLACE FUNCTION get_territory_sales_summary(
  territory_id_param uuid,
  start_date_param date DEFAULT CURRENT_DATE - INTERVAL '30 days',
  end_date_param date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_sales numeric,
  total_orders bigint,
  total_retailers bigint
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(SUM(o.total_amount), 0) as total_sales,
    COUNT(DISTINCT o.id) as total_orders,
    COUNT(DISTINCT r.id) as total_retailers
  FROM territories t
  LEFT JOIN retailers r ON r.id IN (
    SELECT id FROM retailers 
    WHERE EXISTS (
      SELECT 1 FROM unnest(t.pincode_ranges) AS pincode
      WHERE retailers.address LIKE '%' || pincode || '%'
    )
  )
  LEFT JOIN orders o ON o.retailer_id = r.id 
    AND o.created_at::date BETWEEN start_date_param AND end_date_param
  WHERE t.id = territory_id_param
  GROUP BY t.id;
$$;
-- Drop existing functions first
DROP FUNCTION IF EXISTS public.get_product_revenue_performance(text);
DROP FUNCTION IF EXISTS public.get_product_revenue_performance(text, date, date);

-- Recreate with unit column from order_items
CREATE OR REPLACE FUNCTION public.get_product_revenue_performance(
  user_full_name text, 
  start_date date DEFAULT '2025-12-19'::date, 
  end_date date DEFAULT '2025-12-26'::date
)
RETURNS TABLE(
  full_name text, 
  product_name text, 
  unit text,
  quantity_sold bigint, 
  revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    p.full_name::text,
    oi.product_name::text,
    oi.unit::text,
    SUM(oi.quantity)::bigint AS quantity_sold,
    SUM(oi.total)::numeric AS revenue
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN profiles p ON o.user_id = p.id
  WHERE o.created_at::date BETWEEN start_date AND end_date
    AND trim(p.full_name) ILIKE trim(user_full_name)
  GROUP BY p.full_name, oi.product_name, oi.unit
  ORDER BY revenue DESC;
END;
$function$;
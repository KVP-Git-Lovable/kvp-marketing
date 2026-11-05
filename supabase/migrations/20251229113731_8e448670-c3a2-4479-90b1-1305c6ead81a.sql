-- Update RPC function for product and revenue performance to accept date range parameters
CREATE OR REPLACE FUNCTION get_product_revenue_performance(
  user_full_name text,
  start_date date DEFAULT '2025-12-19',
  end_date date DEFAULT '2025-12-26'
)
RETURNS TABLE (
  full_name text,
  product_name text,
  quantity_sold bigint,
  revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.full_name::text,
    oi.product_name::text,
    SUM(oi.quantity)::bigint AS quantity_sold,
    SUM(oi.total)::numeric AS revenue
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN profiles p ON o.user_id = p.id
  WHERE o.created_at::date BETWEEN start_date AND end_date
    AND trim(p.full_name) ILIKE trim(user_full_name)
  GROUP BY p.full_name, oi.product_name
  ORDER BY revenue DESC;
END;
$$;
-- Create RPC function for product and revenue performance
CREATE OR REPLACE FUNCTION get_product_revenue_performance(user_full_name text)
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
  WHERE o.created_at BETWEEN '2025-12-19' AND '2025-12-26'
    AND trim(p.full_name) ILIKE trim(user_full_name)
  GROUP BY p.full_name, oi.product_name
  ORDER BY revenue DESC;
END;
$$;
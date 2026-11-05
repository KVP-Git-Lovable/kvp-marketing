CREATE OR REPLACE FUNCTION public.get_company_top_sellers(p_days int DEFAULT 30)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  total_value numeric,
  total_qty numeric,
  order_count bigint,
  unit_lines jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH lines AS (
    SELECT
      oi.product_id,
      oi.product_name,
      oi.total,
      oi.quantity,
      oi.unit,
      oi.order_id
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE lower(o.status) = 'confirmed'
      AND o.created_at >= now() - make_interval(days => p_days)
  ),
  active_lines AS (
    SELECT l.*
    FROM lines l
    JOIN public.products p ON p.id = l.product_id
    WHERE COALESCE(p.is_active, true)
  ),
  agg AS (
    SELECT
      product_id,
      max(product_name) AS product_name,
      sum(total) AS total_value,
      sum(quantity) AS total_qty,
      count(DISTINCT order_id) AS order_count,
      jsonb_object_agg(unit, qtys) AS unit_lines
    FROM (
      SELECT
        product_id,
        product_name,
        order_id,
        total,
        quantity,
        unit,
        array_agg(quantity) AS qtys
      FROM active_lines
      GROUP BY product_id, product_name, order_id, total, quantity, unit
    ) per_line
    GROUP BY product_id
  )
  SELECT
    product_id,
    product_name,
    total_value,
    total_qty,
    order_count,
    unit_lines
  FROM agg
  ORDER BY total_value DESC, total_qty DESC
  LIMIT 2;
$$;

REVOKE ALL ON FUNCTION public.get_company_top_sellers(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_company_top_sellers(int) TO authenticated;
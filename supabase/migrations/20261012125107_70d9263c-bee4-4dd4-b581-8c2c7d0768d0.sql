CREATE OR REPLACE FUNCTION public.get_category_starter_products(p_category text, p_days int DEFAULT 30)
RETURNS TABLE (product_id uuid, variant_id uuid, product_name text, store_count bigint, total_qty numeric, total_value numeric, unit_lines jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH active_lines AS (
    SELECT oi.product_id, oi.variant_id,
           COALESCE(pv.variant_name, p.name, oi.product_name) AS display_name,
           oi.total, oi.quantity, COALESCE(oi.unit, '') AS unit, o.retailer_id
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    JOIN public.retailers r ON r.id = o.retailer_id
    JOIN public.products p ON p.id = oi.product_id
    LEFT JOIN public.product_variants pv ON pv.id = oi.variant_id
    WHERE lower(o.status) = 'confirmed'
      AND o.created_at >= now() - make_interval(days => p_days)
      AND lower(trim(r.category)) = lower(trim(p_category))
      AND length(trim(coalesce(p_category, ''))) > 0
      AND ((oi.variant_id IS NULL AND COALESCE(p.is_active, true))
        OR (oi.variant_id IS NOT NULL AND pv.id IS NOT NULL AND COALESCE(pv.is_active, true)))
  ),
  per_unit AS (
    SELECT product_id, variant_id, unit, jsonb_agg(quantity) AS qtys
    FROM active_lines GROUP BY product_id, variant_id, unit
  ),
  agg AS (
    SELECT product_id, variant_id, max(display_name) AS product_name,
           count(DISTINCT retailer_id) AS store_count,
           sum(quantity) AS total_qty, sum(total) AS total_value
    FROM active_lines GROUP BY product_id, variant_id
  )
  SELECT a.product_id, a.variant_id, a.product_name, a.store_count, a.total_qty, a.total_value,
         (SELECT jsonb_object_agg(u.unit, u.qtys) FROM per_unit u
           WHERE u.product_id = a.product_id AND u.variant_id IS NOT DISTINCT FROM a.variant_id) AS unit_lines
  FROM agg a
  WHERE a.store_count >= 3
  ORDER BY a.store_count DESC, a.total_qty DESC, a.total_value DESC
  LIMIT 10;
$$;
REVOKE ALL ON FUNCTION public.get_category_starter_products(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_category_starter_products(text, int) TO authenticated;
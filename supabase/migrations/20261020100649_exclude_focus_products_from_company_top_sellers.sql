CREATE OR REPLACE FUNCTION public.get_company_top_sellers(p_days integer DEFAULT 30)
 RETURNS TABLE(product_id uuid, variant_id uuid, product_name text, total_value numeric, total_qty numeric, order_count bigint, unit_lines jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH active_lines AS (
    SELECT oi.product_id, oi.variant_id,
           COALESCE(pv.variant_name, p.name, oi.product_name) AS display_name,
           oi.total, oi.quantity, COALESCE(oi.unit, '') AS unit, oi.order_id
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    JOIN public.products p ON p.id = oi.product_id
    LEFT JOIN public.product_variants pv ON pv.id = oi.variant_id
    WHERE lower(o.status) = 'confirmed'
      AND o.created_at >= now() - make_interval(days => p_days)
      AND ((oi.variant_id IS NULL AND COALESCE(p.is_active, true))
        OR (oi.variant_id IS NOT NULL AND pv.id IS NOT NULL AND COALESCE(pv.is_active, true)))
      AND NOT (COALESCE(p.is_focused_product, false) OR COALESCE(pv.is_focused_product, false))
  ),
  per_unit AS (
    SELECT product_id, variant_id, unit, jsonb_agg(quantity) AS qtys
    FROM active_lines GROUP BY product_id, variant_id, unit
  ),
  agg AS (
    SELECT product_id, variant_id, max(display_name) AS product_name,
           sum(total) AS total_value, sum(quantity) AS total_qty,
           count(DISTINCT order_id) AS order_count
    FROM active_lines GROUP BY product_id, variant_id
  )
  SELECT a.product_id, a.variant_id, a.product_name, a.total_value, a.total_qty, a.order_count,
         (SELECT jsonb_object_agg(u.unit, u.qtys) FROM per_unit u
           WHERE u.product_id = a.product_id AND u.variant_id IS NOT DISTINCT FROM a.variant_id) AS unit_lines
  FROM agg a
  ORDER BY a.order_count DESC, a.total_qty DESC, a.total_value DESC
  LIMIT 2;
$function$;

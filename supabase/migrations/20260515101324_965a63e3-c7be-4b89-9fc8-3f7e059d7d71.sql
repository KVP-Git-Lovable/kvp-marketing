WITH guesses AS (
  SELECT
    oi.id AS item_id,
    (SELECT o.id
       FROM public.orders o
      WHERE o.created_at <= oi.created_at + interval '2 seconds'
        AND o.created_at >= oi.created_at - interval '120 seconds'
      ORDER BY o.created_at DESC
      LIMIT 1) AS guessed_order_id
  FROM public.order_items oi
  WHERE oi.order_id IS NULL
),
verified AS (
  SELECT g.item_id, g.guessed_order_id
  FROM guesses g
  WHERE g.guessed_order_id IS NOT NULL
),
order_sums AS (
  SELECT
    v.guessed_order_id AS order_id,
    SUM(oi.total) AS items_sum,
    o.total_amount AS order_total
  FROM verified v
  JOIN public.order_items oi ON oi.id = v.item_id
  JOIN public.orders o ON o.id = v.guessed_order_id
  GROUP BY v.guessed_order_id, o.total_amount
),
good_orders AS (
  SELECT order_id FROM order_sums
  WHERE abs(items_sum - order_total) <= 1
)
UPDATE public.order_items oi
   SET order_id = v.guessed_order_id
  FROM verified v
 WHERE oi.id = v.item_id
   AND v.guessed_order_id IN (SELECT order_id FROM good_orders);
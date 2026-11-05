-- Second backfill pass: relink orphan order_items to nearest order within ±15 min, verified by subtotal match
WITH candidates AS (
  SELECT oi.id AS item_id,
         o.id  AS cand_order_id,
         o.subtotal AS order_subtotal,
         oi.total AS item_total
  FROM public.order_items oi
  JOIN LATERAL (
    SELECT o2.id, o2.subtotal, o2.created_at
    FROM public.orders o2
    WHERE ABS(EXTRACT(EPOCH FROM (o2.created_at - oi.created_at))) <= 900
    ORDER BY ABS(EXTRACT(EPOCH FROM (o2.created_at - oi.created_at)))
    LIMIT 1
  ) o ON true
  WHERE oi.order_id IS NULL
),
groups AS (
  SELECT cand_order_id, SUM(item_total) AS items_sum, MAX(order_subtotal) AS order_subtotal
  FROM candidates
  GROUP BY cand_order_id
),
valid AS (
  SELECT cand_order_id FROM groups WHERE ABS(items_sum - order_subtotal) <= 1
)
UPDATE public.order_items oi
SET order_id = c.cand_order_id
FROM candidates c
WHERE oi.id = c.item_id
  AND c.cand_order_id IN (SELECT cand_order_id FROM valid)
  AND oi.order_id IS NULL;
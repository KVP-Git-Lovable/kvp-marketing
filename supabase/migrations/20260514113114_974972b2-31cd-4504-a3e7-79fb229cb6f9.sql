-- 1. Build orphan groups (one per second of created_at) and best-matching empty order
WITH orphan_groups AS (
  SELECT
    date_trunc('second', created_at) AS sec,
    min(created_at) AS first_at,
    array_agg(id) AS item_ids
  FROM public.order_items
  WHERE order_id IS NULL
  GROUP BY date_trunc('second', created_at)
),
empty_orders AS (
  SELECT o.id, o.created_at
  FROM public.orders o
  WHERE NOT EXISTS (
    SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id
  )
),
ranked AS (
  SELECT
    og.sec,
    og.item_ids,
    eo.id AS order_id,
    abs(extract(epoch FROM (eo.created_at - og.first_at))) AS diff_sec,
    row_number() OVER (
      PARTITION BY og.sec
      ORDER BY abs(extract(epoch FROM (eo.created_at - og.first_at)))
    ) AS rn_for_group,
    row_number() OVER (
      PARTITION BY eo.id
      ORDER BY abs(extract(epoch FROM (eo.created_at - og.first_at)))
    ) AS rn_for_order
  FROM orphan_groups og
  JOIN empty_orders eo
    ON abs(extract(epoch FROM (eo.created_at - og.first_at))) <= 60
),
matches AS (
  SELECT order_id, item_ids
  FROM ranked
  WHERE rn_for_group = 1 AND rn_for_order = 1
)
UPDATE public.order_items oi
SET order_id = m.order_id
FROM matches m
WHERE oi.id = ANY(m.item_ids)
  AND oi.order_id IS NULL;

-- 2. Delete remaining unrecoverable orphans
DELETE FROM public.order_items WHERE order_id IS NULL;

-- 3. Prevent recurrence
ALTER TABLE public.order_items ALTER COLUMN order_id SET NOT NULL;

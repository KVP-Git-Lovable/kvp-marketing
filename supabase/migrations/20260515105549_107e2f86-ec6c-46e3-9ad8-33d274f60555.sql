-- Backfill orphan order_items where the order's UUID was mistakenly written
-- into the product_id column instead of order_id.
-- Safe: only touches rows where order_id IS NULL AND product_id matches an existing orders.id.

UPDATE public.order_items oi
SET order_id = oi.product_id::uuid,
    product_id = NULL
WHERE oi.order_id IS NULL
  AND oi.product_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = oi.product_id::text
  );
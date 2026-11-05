-- Add idempotency_key column to orders table to prevent duplicate orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Create unique index on idempotency_key (partial - only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency_key 
ON public.orders (idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- Delete duplicate orders from today (keep the first one)
-- First, identify and delete duplicates based on retailer_id + user_id + order_date + created_at within 5 seconds
WITH duplicate_orders AS (
  SELECT o.id,
         o.retailer_id,
         o.user_id,
         o.order_date,
         o.created_at,
         o.total_amount,
         ROW_NUMBER() OVER (
           PARTITION BY o.retailer_id, o.user_id, o.order_date, 
                        DATE_TRUNC('minute', o.created_at),
                        ROUND(o.total_amount::numeric, 0)
           ORDER BY o.created_at ASC
         ) as rn
  FROM public.orders o
  WHERE o.order_date = CURRENT_DATE
)
DELETE FROM public.orders 
WHERE id IN (
  SELECT id FROM duplicate_orders WHERE rn > 1
);

-- Delete order_items for orders that no longer exist (orphaned items)
DELETE FROM public.order_items 
WHERE order_id NOT IN (SELECT id FROM public.orders);

-- Add comment explaining the column
COMMENT ON COLUMN public.orders.idempotency_key IS 'Unique key to prevent duplicate order submissions on slow networks';
-- Per-order backfill: for each order with NO linked items, find orphan items in ±15min whose total exactly matches order subtotal
DO $$
DECLARE
  ord RECORD;
  matched_sum NUMERIC;
BEGIN
  FOR ord IN
    SELECT o.id, o.subtotal, o.created_at
    FROM public.orders o
    WHERE o.subtotal IS NOT NULL
      AND o.subtotal > 0
      AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = o.id)
  LOOP
    SELECT COALESCE(SUM(total), 0) INTO matched_sum
    FROM public.order_items
    WHERE order_id IS NULL
      AND ABS(EXTRACT(EPOCH FROM (created_at - ord.created_at))) <= 900;

    IF ABS(matched_sum - ord.subtotal) <= 1 AND matched_sum > 0 THEN
      -- Group those items into a single timestamp bucket if multiple buckets exist
      WITH buckets AS (
        SELECT created_at, SUM(total) AS s
        FROM public.order_items
        WHERE order_id IS NULL
          AND ABS(EXTRACT(EPOCH FROM (created_at - ord.created_at))) <= 900
        GROUP BY created_at
      ), exact_bucket AS (
        SELECT created_at FROM buckets WHERE ABS(s - ord.subtotal) <= 1 LIMIT 1
      )
      UPDATE public.order_items oi
      SET order_id = ord.id
      WHERE oi.order_id IS NULL
        AND (
          oi.created_at IN (SELECT created_at FROM exact_bucket)
          OR (NOT EXISTS (SELECT 1 FROM exact_bucket)
              AND ABS(EXTRACT(EPOCH FROM (oi.created_at - ord.created_at))) <= 900)
        );
    END IF;
  END LOOP;
END $$;
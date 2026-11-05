-- Enable realtime + fix duplicates for van stock admin updates

-- 1) Remove duplicate van_stock_items rows (keep newest per (van_stock_id, product_id))
WITH ranked AS (
  SELECT
    ctid,
    van_stock_id,
    product_id,
    ROW_NUMBER() OVER (
      PARTITION BY van_stock_id, product_id
      ORDER BY updated_at DESC, created_at DESC, ctid DESC
    ) AS rn
  FROM public.van_stock_items
)
DELETE FROM public.van_stock_items v
USING ranked r
WHERE v.ctid = r.ctid
  AND r.rn > 1;

-- 2) Prevent future duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'van_stock_items_unique_stock_product'
  ) THEN
    ALTER TABLE public.van_stock_items
      ADD CONSTRAINT van_stock_items_unique_stock_product
      UNIQUE (van_stock_id, product_id);
  END IF;
END $$;

-- 3) Ensure full row payloads for UPDATE events
ALTER TABLE public.van_stock REPLICA IDENTITY FULL;
ALTER TABLE public.van_stock_items REPLICA IDENTITY FULL;
ALTER TABLE public.van_stock_opening_edits REPLICA IDENTITY FULL;

-- 4) Add tables to realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='van_stock'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.van_stock';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='van_stock_items'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.van_stock_items';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='van_stock_opening_edits'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.van_stock_opening_edits';
  END IF;
END $$;
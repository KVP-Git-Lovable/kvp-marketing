-- Add retailer linkage to orders for per-retailer ordering and analytics
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS retailer_id uuid;

-- Add a foreign key to retailers (kept nullable to preserve existing data)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'orders_retailer_id_fkey'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_retailer_id_fkey
      FOREIGN KEY (retailer_id)
      REFERENCES public.retailers(id)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

-- Helpful indexes for today views and lookups
CREATE INDEX IF NOT EXISTS idx_orders_user_retailer_date 
  ON public.orders (user_id, retailer_id, created_at);

-- Optional: ensure status has common values; keep as text for flexibility
-- We will use 'confirmed' for submitted orders in the app.
-- Add unique constraint required for upsert on stock
ALTER TABLE public.stock
ADD CONSTRAINT stock_unique_user_retailer_visit_product
UNIQUE (user_id, retailer_id, visit_id, product_id);

-- Helpful index for lookups (covers same columns)
CREATE INDEX IF NOT EXISTS idx_stock_composite ON public.stock(user_id, retailer_id, visit_id, product_id);
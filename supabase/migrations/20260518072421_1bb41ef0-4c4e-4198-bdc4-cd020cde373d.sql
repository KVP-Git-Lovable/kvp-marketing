ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS subtotal numeric NOT NULL DEFAULT 0;

UPDATE public.orders
SET subtotal = COALESCE(total_amount, 0) + COALESCE(discount_amount, 0)
WHERE subtotal = 0;
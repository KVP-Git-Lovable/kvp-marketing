-- Add product_number column to products and a partial unique index
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS product_number text;

-- Ensure uniqueness when provided
CREATE UNIQUE INDEX IF NOT EXISTS products_product_number_unique
ON public.products (product_number)
WHERE product_number IS NOT NULL;
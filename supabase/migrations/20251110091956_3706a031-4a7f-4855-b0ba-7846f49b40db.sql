-- Add base_unit and conversion_factor to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS base_unit TEXT DEFAULT 'kg',
ADD COLUMN IF NOT EXISTS conversion_factor NUMERIC DEFAULT 1;

COMMENT ON COLUMN public.products.base_unit IS 'The base unit for pricing (default: kg)';
COMMENT ON COLUMN public.products.conversion_factor IS 'Conversion factor relative to base unit (e.g., 0.001 for grams to kg)';
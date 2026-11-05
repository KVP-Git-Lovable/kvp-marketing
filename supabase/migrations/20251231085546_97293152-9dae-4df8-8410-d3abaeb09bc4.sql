-- Add HSN/SAC code column to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS hsn_code text;

-- Add HSN/SAC code column to product_variants table
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS hsn_code text;

-- Update all existing products with default HSN code
UPDATE public.products SET hsn_code = '90230' WHERE hsn_code IS NULL;

-- Update all existing variants with default HSN code
UPDATE public.product_variants SET hsn_code = '90230' WHERE hsn_code IS NULL;
-- Add SKU image field to products table
ALTER TABLE public.products 
ADD COLUMN sku_image_url TEXT;

COMMENT ON COLUMN public.products.sku_image_url IS 'URL to the product SKU image stored in Supabase storage, used for AI-based stock counting';
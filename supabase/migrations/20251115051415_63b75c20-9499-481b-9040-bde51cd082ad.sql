-- Add new focused product fields to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS barcode_image_url TEXT,
ADD COLUMN IF NOT EXISTS focused_type TEXT CHECK (focused_type IN ('fixed_date', 'recurring', 'keep_open')),
ADD COLUMN IF NOT EXISTS focused_recurring_config JSONB;

-- Add new focused product fields to product_variants table
ALTER TABLE product_variants
ADD COLUMN IF NOT EXISTS barcode_image_url TEXT,
ADD COLUMN IF NOT EXISTS focused_type TEXT CHECK (focused_type IN ('fixed_date', 'recurring', 'keep_open')),
ADD COLUMN IF NOT EXISTS focused_recurring_config JSONB;

-- Add comments
COMMENT ON COLUMN products.barcode_image_url IS 'URL to uploaded barcode image';
COMMENT ON COLUMN products.focused_type IS 'Type of focused product: fixed_date, recurring, or keep_open';
COMMENT ON COLUMN products.focused_recurring_config IS 'Configuration for recurring focused products (days, weeks, months)';
COMMENT ON COLUMN product_variants.barcode_image_url IS 'URL to uploaded barcode image';
COMMENT ON COLUMN product_variants.focused_type IS 'Type of focused product: fixed_date, recurring, or keep_open';
COMMENT ON COLUMN product_variants.focused_recurring_config IS 'Configuration for recurring focused products (days, weeks, months)';
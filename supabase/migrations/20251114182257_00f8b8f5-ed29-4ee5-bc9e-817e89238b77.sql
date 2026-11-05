-- Add barcode and qr_code fields to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS barcode TEXT,
ADD COLUMN IF NOT EXISTS qr_code TEXT;

-- Add barcode and qr_code fields to product_variants table
ALTER TABLE product_variants 
ADD COLUMN IF NOT EXISTS barcode TEXT,
ADD COLUMN IF NOT EXISTS qr_code TEXT;

-- Add focused product fields to product_variants table
ALTER TABLE product_variants
ADD COLUMN IF NOT EXISTS is_focused_product BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS focused_due_date DATE,
ADD COLUMN IF NOT EXISTS focused_target_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS focused_territories TEXT[];

-- Add comments
COMMENT ON COLUMN products.barcode IS 'Product barcode for scanning';
COMMENT ON COLUMN products.qr_code IS 'Auto-generated QR code for product';
COMMENT ON COLUMN product_variants.barcode IS 'Variant barcode for scanning';
COMMENT ON COLUMN product_variants.qr_code IS 'Auto-generated QR code for variant';
COMMENT ON COLUMN product_variants.is_focused_product IS 'Whether this variant is a focused product';
COMMENT ON COLUMN product_variants.focused_due_date IS 'Due date for focused product status';
COMMENT ON COLUMN product_variants.focused_target_quantity IS 'Target quantity for focused product';
COMMENT ON COLUMN product_variants.focused_territories IS 'Territories where this variant is focused';
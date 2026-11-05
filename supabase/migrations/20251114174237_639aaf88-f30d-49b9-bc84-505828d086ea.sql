-- Add focused product fields to products table
ALTER TABLE products
ADD COLUMN is_focused_product BOOLEAN DEFAULT FALSE,
ADD COLUMN focused_due_date DATE,
ADD COLUMN focused_target_quantity INTEGER,
ADD COLUMN focused_territories TEXT[];

-- Create index for faster queries on focused products
CREATE INDEX idx_products_focused ON products(is_focused_product) WHERE is_focused_product = TRUE;

-- Add comment for focused_due_date field
COMMENT ON COLUMN products.focused_due_date IS 'This is a focused product until this date';
COMMENT ON COLUMN products.focused_target_quantity IS 'Target quantity to achieve for focused product';
COMMENT ON COLUMN products.focused_territories IS 'Territories where this product is focused';
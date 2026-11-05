-- Add unit columns to product_schemes for BOGO
ALTER TABLE product_schemes 
ADD COLUMN IF NOT EXISTS buy_quantity_unit TEXT DEFAULT 'kg',
ADD COLUMN IF NOT EXISTS free_quantity_unit TEXT DEFAULT 'kg';
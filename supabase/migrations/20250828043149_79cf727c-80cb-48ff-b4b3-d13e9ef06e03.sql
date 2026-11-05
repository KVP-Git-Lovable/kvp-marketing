-- Add additional fields to product_schemes table to support new scheme types

-- Add fields for bundle/combo schemes (multiple products)
ALTER TABLE product_schemes 
ADD COLUMN IF NOT EXISTS bundle_product_ids TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS bundle_discount_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS bundle_discount_percentage NUMERIC DEFAULT 0;

-- Add fields for tiered discounts (JSON structure for multiple tiers)
ALTER TABLE product_schemes 
ADD COLUMN IF NOT EXISTS tier_data JSONB DEFAULT '[]';

-- Add field for category-wide schemes
ALTER TABLE product_schemes 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES product_categories(id);

-- Add fields for Buy X Get Y Free schemes
ALTER TABLE product_schemes 
ADD COLUMN IF NOT EXISTS free_product_id UUID REFERENCES products(id),
ADD COLUMN IF NOT EXISTS buy_quantity INTEGER DEFAULT 0;

-- Add fields for first order and time-based offers
ALTER TABLE product_schemes 
ADD COLUMN IF NOT EXISTS is_first_order_only BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS validity_days INTEGER DEFAULT NULL;

-- Add field for minimum order value conditions
ALTER TABLE product_schemes 
ADD COLUMN IF NOT EXISTS min_order_value NUMERIC DEFAULT 0;

-- Update existing scheme_type values to match new format
UPDATE product_schemes SET scheme_type = 'percentage_discount' WHERE scheme_type = 'discount';
UPDATE product_schemes SET scheme_type = 'flat_discount' WHERE scheme_type = 'percentage_off';
UPDATE product_schemes SET scheme_type = 'buy_x_get_y_free' WHERE scheme_type = 'buy_x_get_y';
UPDATE product_schemes SET scheme_type = 'tiered_discount' WHERE scheme_type = 'volume_discount';

-- Drop existing constraint if it exists
ALTER TABLE product_schemes DROP CONSTRAINT IF EXISTS valid_scheme_type;

-- Add constraint to validate scheme types
ALTER TABLE product_schemes 
ADD CONSTRAINT valid_scheme_type 
CHECK (scheme_type IN (
  'percentage_discount',
  'flat_discount', 
  'buy_x_get_y_free',
  'bundle_combo',
  'tiered_discount',
  'time_based_offer',
  'first_order_discount',
  'category_wide_discount'
));
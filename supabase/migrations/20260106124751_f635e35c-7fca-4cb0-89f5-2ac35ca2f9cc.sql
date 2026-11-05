-- Add multi-product support to product_schemes table
ALTER TABLE product_schemes 
ADD COLUMN IF NOT EXISTS target_product_ids uuid[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS per_product_discounts jsonb DEFAULT NULL;

-- Add comment to explain the columns
COMMENT ON COLUMN product_schemes.target_product_ids IS 'Array of product IDs when multi-product selection is used';
COMMENT ON COLUMN product_schemes.per_product_discounts IS 'JSON object mapping product_id to discount config: {"product-uuid": {"discount_percentage": 10}}';
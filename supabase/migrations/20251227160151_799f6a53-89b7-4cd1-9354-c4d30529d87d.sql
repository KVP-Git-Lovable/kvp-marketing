-- Add columns to order_items for tracking offer prices, discounts, and GST
ALTER TABLE order_items 
ADD COLUMN IF NOT EXISTS original_rate NUMERIC,
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS hsn_code TEXT,
ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC DEFAULT 0;
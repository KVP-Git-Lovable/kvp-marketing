-- Add UPI Last-4 Code column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS upi_last_four_code TEXT;
-- Add order_date as a regular date column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS order_date DATE;

-- Create function to automatically set order_date from created_at
CREATE OR REPLACE FUNCTION set_order_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_date := NEW.created_at::date;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically populate order_date on insert
DROP TRIGGER IF EXISTS trigger_set_order_date ON orders;
CREATE TRIGGER trigger_set_order_date
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_date();

-- Backfill existing records
UPDATE orders 
SET order_date = created_at::date 
WHERE order_date IS NULL;

-- Create index on order_date for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);

-- Add comment explaining the column
COMMENT ON COLUMN orders.order_date IS 'Order date derived from created_at timestamp';
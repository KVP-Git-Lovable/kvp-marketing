-- Add cancellation tracking columns to orders table
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES profiles(id);

-- Create index for efficient cancelled order queries
CREATE INDEX IF NOT EXISTS idx_orders_cancelled_at 
  ON orders(cancelled_at) 
  WHERE cancelled_at IS NOT NULL;
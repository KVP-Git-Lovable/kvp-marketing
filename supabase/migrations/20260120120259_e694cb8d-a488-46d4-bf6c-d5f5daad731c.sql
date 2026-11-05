-- Add Order-Based Delivery feature flag (independent from Van Sales)
INSERT INTO feature_flags (feature_key, feature_name, description, category, is_enabled)
VALUES 
  ('order_based_delivery', 'Order-Based Delivery', 'Enable order-based delivery workflow with COD/Pay Now options. When enabled and Van Sales is disabled, only "Place Order for Next Day" option is shown in Order Entry.', 'Delivery', false)
ON CONFLICT (feature_key) DO NOTHING;

-- Add payment fields to orders table for order-based delivery flow
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
COMMENT ON COLUMN orders.payment_status IS 'Payment status: pending, partial, paid';

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_payment_method TEXT;
COMMENT ON COLUMN orders.delivery_payment_method IS 'Payment method for order-based delivery: cod, pay_now';

ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_collected DECIMAL(12,2) DEFAULT 0;
COMMENT ON COLUMN orders.amount_collected IS 'Amount collected at delivery time';

ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_generated_at TIMESTAMPTZ;
COMMENT ON COLUMN orders.invoice_generated_at IS 'Timestamp when invoice was generated (for COD orders, this is at delivery)';

-- Add index for payment status queries
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
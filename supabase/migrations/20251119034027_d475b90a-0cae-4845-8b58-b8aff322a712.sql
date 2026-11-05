
-- Add order_id and is_edited columns to invoices table for linking edited invoices to orders
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);

-- Add comment for documentation
COMMENT ON COLUMN invoices.order_id IS 'Links edited invoice to original order';
COMMENT ON COLUMN invoices.is_edited IS 'Indicates if this invoice has been manually edited';

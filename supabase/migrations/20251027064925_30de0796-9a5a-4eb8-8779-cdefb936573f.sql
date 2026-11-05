-- Add credit order tracking columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS is_credit_order BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS credit_pending_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_paid_amount DECIMAL(10,2) DEFAULT 0;

-- Add pending amount tracking to retailers table
ALTER TABLE public.retailers
ADD COLUMN IF NOT EXISTS pending_amount DECIMAL(10,2) DEFAULT 0;

-- Create index for faster lookups of credit orders
CREATE INDEX IF NOT EXISTS idx_orders_credit ON public.orders(retailer_id, is_credit_order) WHERE is_credit_order = true;
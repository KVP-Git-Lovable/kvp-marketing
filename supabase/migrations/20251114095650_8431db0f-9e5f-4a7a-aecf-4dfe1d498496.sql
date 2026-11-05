-- Update invoice number generation to new format INV2025-001
DROP FUNCTION IF EXISTS public.generate_invoice_number();

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_val INTEGER;
  year_part TEXT;
BEGIN
  SELECT nextval('invoice_number_seq') INTO next_val;
  SELECT TO_CHAR(CURRENT_DATE, 'YYYY') INTO year_part;
  -- New format: INV2025-001 instead of INV/2025/0001
  RETURN 'INV' || year_part || '-' || LPAD(next_val::TEXT, 3, '0');
END;
$$;

-- Add invoice_number column to orders table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'invoice_number'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN invoice_number TEXT;
  END IF;
END $$;

-- Create trigger to auto-generate invoice numbers for orders
DROP TRIGGER IF EXISTS set_order_invoice_number ON public.orders;

CREATE OR REPLACE FUNCTION public.set_order_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := generate_invoice_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_order_invoice_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_order_invoice_number();

-- Backfill existing orders with invoice numbers using CTE
WITH numbered_orders AS (
  SELECT 
    id,
    'INV' || TO_CHAR(created_at, 'YYYY') || '-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 3, '0') as new_invoice_number
  FROM public.orders
  WHERE invoice_number IS NULL OR invoice_number = ''
)
UPDATE public.orders 
SET invoice_number = numbered_orders.new_invoice_number
FROM numbered_orders
WHERE orders.id = numbered_orders.id;
-- Add returned_qty column to van_stock_items table
ALTER TABLE public.van_stock_items 
ADD COLUMN returned_qty integer NOT NULL DEFAULT 0;

-- Update the calculation logic comment for clarity
COMMENT ON COLUMN public.van_stock_items.left_qty IS 'Calculated as: start_qty - ordered_qty + returned_qty';
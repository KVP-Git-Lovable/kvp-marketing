-- Add target_type column to distinguish between distributor and retailer price books
ALTER TABLE public.price_books 
ADD COLUMN IF NOT EXISTS target_type text DEFAULT 'distributor' CHECK (target_type IN ('distributor', 'retailer'));

-- Add apply_to_all_territories column
ALTER TABLE public.price_books 
ADD COLUMN IF NOT EXISTS apply_to_all_territories boolean DEFAULT false;

-- Update existing records
UPDATE public.price_books 
SET target_type = CASE 
  WHEN price_book_type IN ('retailer_territory') THEN 'retailer'
  ELSE 'distributor'
END
WHERE target_type IS NULL;
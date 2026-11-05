-- Add new columns to product_schemes table for enhanced scheme functionality
ALTER TABLE public.product_schemes 
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id),
ADD COLUMN IF NOT EXISTS quantity_condition_type TEXT DEFAULT 'more_than';

-- Add check constraint for quantity_condition_type
ALTER TABLE public.product_schemes 
ADD CONSTRAINT quantity_condition_type_check 
CHECK (quantity_condition_type IN ('more_than', 'less_than', 'equal_to'));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_product_schemes_variant_id ON public.product_schemes(variant_id);

-- Update existing records to have default quantity_condition_type
UPDATE public.product_schemes 
SET quantity_condition_type = 'more_than' 
WHERE quantity_condition_type IS NULL;
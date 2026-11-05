-- Create distributor_retailer_mappings table to link distributors to retailers
CREATE TABLE public.distributor_retailer_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  distributor_id UUID NOT NULL,
  retailer_id UUID NOT NULL,
  user_id UUID NOT NULL,
  mapping_type TEXT NOT NULL DEFAULT 'all_items', -- 'all_items' or 'specific_items'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(distributor_id, retailer_id)
);

-- Create distributor_item_mappings table for specific item assignments
CREATE TABLE public.distributor_item_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mapping_id UUID NOT NULL REFERENCES public.distributor_retailer_mappings(id) ON DELETE CASCADE,
  product_id UUID,
  category_id UUID,
  product_name TEXT,
  category_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT check_product_or_category CHECK (
    (product_id IS NOT NULL OR category_id IS NOT NULL) AND
    (product_name IS NOT NULL OR category_name IS NOT NULL)
  )
);

-- Enable Row Level Security
ALTER TABLE public.distributor_retailer_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributor_item_mappings ENABLE ROW LEVEL SECURITY;

-- Create policies for distributor_retailer_mappings
CREATE POLICY "Users can manage their own distributor retailer mappings"
ON public.distributor_retailer_mappings
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create policies for distributor_item_mappings
CREATE POLICY "Users can manage distributor item mappings"
ON public.distributor_item_mappings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.distributor_retailer_mappings drm
    WHERE drm.id = distributor_item_mappings.mapping_id
    AND drm.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.distributor_retailer_mappings drm
    WHERE drm.id = distributor_item_mappings.mapping_id
    AND drm.user_id = auth.uid()
  )
);

-- Create function to update timestamps
CREATE TRIGGER update_distributor_retailer_mappings_updated_at
BEFORE UPDATE ON public.distributor_retailer_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add distributor_id column to orders table to track which distributor supplied the order
ALTER TABLE public.orders ADD COLUMN distributor_id UUID;
ALTER TABLE public.orders ADD COLUMN distributor_name TEXT;
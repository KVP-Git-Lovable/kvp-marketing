-- Add missing fields to distributors table
ALTER TABLE public.distributors 
ADD COLUMN IF NOT EXISTS gst_number text,
ADD COLUMN IF NOT EXISTS parent_type text CHECK (parent_type IN ('super_stockist', 'company')),
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.distributors(id);

-- Add competitors field to vendors table (rename from skills if needed)
ALTER TABLE public.vendors 
ADD COLUMN IF NOT EXISTS competitors text[] DEFAULT '{}';

-- Update existing skills column name to competitors for vendors
COMMENT ON COLUMN public.vendors.skills IS 'Renamed to competitors - represents top 3 competitors or brands they support';

-- Create index for parent lookup
CREATE INDEX IF NOT EXISTS idx_distributors_parent_id ON public.distributors(parent_id);
CREATE INDEX IF NOT EXISTS idx_distributors_parent_type ON public.distributors(parent_type);
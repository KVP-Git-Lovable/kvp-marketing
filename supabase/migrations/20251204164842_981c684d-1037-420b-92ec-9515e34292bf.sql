-- Add new columns to retailer_feedback table for the redesigned form
ALTER TABLE public.retailer_feedback 
ADD COLUMN IF NOT EXISTS product_packaging integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS product_sku_range integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS product_quality integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS product_placement integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS summary_notes text,
ADD COLUMN IF NOT EXISTS score numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS feedback_date date DEFAULT CURRENT_DATE;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_retailer_feedback_date ON public.retailer_feedback(retailer_id, feedback_date, user_id);
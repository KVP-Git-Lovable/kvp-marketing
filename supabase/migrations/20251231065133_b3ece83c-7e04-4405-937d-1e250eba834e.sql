-- Add edit_source column to track where edits originated from
ALTER TABLE public.van_stock_opening_edits 
ADD COLUMN IF NOT EXISTS edit_source TEXT DEFAULT 'load_previous';

-- Add comment for clarity
COMMENT ON COLUMN public.van_stock_opening_edits.edit_source IS 'Source of edit: load_previous (from Load Previous Van Stock) or manual_edit (from Edit button in Product Stock in Van)';
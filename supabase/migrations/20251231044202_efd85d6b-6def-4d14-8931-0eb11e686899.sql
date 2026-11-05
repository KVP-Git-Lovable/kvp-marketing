-- Create a table to track opening GRN edits (when user loads previous van stock and modifies quantities)
CREATE TABLE IF NOT EXISTS public.van_stock_opening_edits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  van_stock_id UUID NOT NULL REFERENCES public.van_stock(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  previous_qty INTEGER NOT NULL DEFAULT 0,
  edited_qty INTEGER NOT NULL DEFAULT 0,
  difference INTEGER NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'Grams',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for faster queries
CREATE INDEX idx_van_stock_opening_edits_user_id ON public.van_stock_opening_edits(user_id);
CREATE INDEX idx_van_stock_opening_edits_van_stock_id ON public.van_stock_opening_edits(van_stock_id);
CREATE INDEX idx_van_stock_opening_edits_created_at ON public.van_stock_opening_edits(created_at);

-- Enable RLS
ALTER TABLE public.van_stock_opening_edits ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to view (admin filtering done in application)
CREATE POLICY "Authenticated users can view opening edits" 
ON public.van_stock_opening_edits 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Policy: Users can insert their own edits
CREATE POLICY "Users can insert their own opening edits" 
ON public.van_stock_opening_edits 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own edits
CREATE POLICY "Users can update their own opening edits" 
ON public.van_stock_opening_edits 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Policy: Users can delete their own edits
CREATE POLICY "Users can delete their own opening edits" 
ON public.van_stock_opening_edits 
FOR DELETE 
USING (auth.uid() = user_id);
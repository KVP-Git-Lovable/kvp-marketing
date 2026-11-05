-- Add uom column to price_book_entries table
ALTER TABLE public.price_book_entries 
ADD COLUMN IF NOT EXISTS uom TEXT;
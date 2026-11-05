-- Add column to track previous pending amount cleared during order
ALTER TABLE public.orders 
ADD COLUMN previous_pending_cleared numeric DEFAULT 0;
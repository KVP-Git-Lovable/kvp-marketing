-- Add consumer_satisfaction column to retailer_feedback table
ALTER TABLE public.retailer_feedback 
ADD COLUMN IF NOT EXISTS consumer_satisfaction integer DEFAULT 0;
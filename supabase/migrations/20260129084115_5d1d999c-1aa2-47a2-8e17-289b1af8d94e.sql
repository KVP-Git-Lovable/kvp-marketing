-- Add place_id column to territories table for Google Maps integration
ALTER TABLE public.territories 
ADD COLUMN IF NOT EXISTS place_id TEXT;
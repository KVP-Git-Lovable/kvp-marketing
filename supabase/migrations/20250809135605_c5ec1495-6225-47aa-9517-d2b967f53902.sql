-- Add extra retailer fields to store data from Add Retailer form
ALTER TABLE public.retailers
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS parent_type text,
  ADD COLUMN IF NOT EXISTS parent_name text,
  ADD COLUMN IF NOT EXISTS location_tag text,
  ADD COLUMN IF NOT EXISTS retail_type text,
  ADD COLUMN IF NOT EXISTS potential text,
  ADD COLUMN IF NOT EXISTS competitors text[];
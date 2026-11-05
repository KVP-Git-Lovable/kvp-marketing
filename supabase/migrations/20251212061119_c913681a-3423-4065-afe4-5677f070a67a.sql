-- Add state column to retailers table
ALTER TABLE public.retailers 
ADD COLUMN IF NOT EXISTS state TEXT;
-- Add beat_name column to retailers table
ALTER TABLE public.retailers 
ADD COLUMN IF NOT EXISTS beat_name TEXT;
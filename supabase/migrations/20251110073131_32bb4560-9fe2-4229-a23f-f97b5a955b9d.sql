-- Add qr_code_url column to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS qr_code_url TEXT;
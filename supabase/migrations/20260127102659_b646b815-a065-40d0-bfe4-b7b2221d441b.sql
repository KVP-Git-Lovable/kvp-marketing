-- Add invoice-related columns to distributors table for Company Profile feature
ALTER TABLE public.distributors ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE public.distributors ADD COLUMN IF NOT EXISTS bank_account text;
ALTER TABLE public.distributors ADD COLUMN IF NOT EXISTS ifsc text;
ALTER TABLE public.distributors ADD COLUMN IF NOT EXISTS account_holder_name text;
ALTER TABLE public.distributors ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.distributors ADD COLUMN IF NOT EXISTS qr_code_url text;
ALTER TABLE public.distributors ADD COLUMN IF NOT EXISTS qr_upi text;
ALTER TABLE public.distributors ADD COLUMN IF NOT EXISTS terms_conditions text;
ALTER TABLE public.distributors ADD COLUMN IF NOT EXISTS state text;
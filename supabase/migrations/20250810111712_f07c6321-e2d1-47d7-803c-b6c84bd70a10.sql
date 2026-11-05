-- Add address columns for reverse geocoding results
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS check_in_address text,
  ADD COLUMN IF NOT EXISTS check_out_address text;

ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS check_in_address text,
  ADD COLUMN IF NOT EXISTS check_out_address text;
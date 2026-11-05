-- Add verification tracking fields to retailers table
ALTER TABLE public.retailers 
  ADD COLUMN IF NOT EXISTS verification_address BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_contact BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_territory BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';

-- Add comment for clarity
COMMENT ON COLUMN public.retailers.verification_status IS 'Values: verified, pending, needs_attention, dropped';
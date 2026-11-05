
-- Add all missing columns to match the target schema
ALTER TABLE public.retailers
  ADD COLUMN IF NOT EXISTS verification_address boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_contact boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_territory boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS ifsc text,
  ADD COLUMN IF NOT EXISTS account_holder_name text,
  ADD COLUMN IF NOT EXISTS qr_upi text,
  ADD COLUMN IF NOT EXISTS terms_conditions text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_name text;

-- Index for owner lookups
CREATE INDEX IF NOT EXISTS idx_retailers_owner_id ON public.retailers USING btree (owner_id);

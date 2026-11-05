-- Add missing columns to distributor_contacts
ALTER TABLE public.distributor_contacts
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS seniority text;

-- Add comment for documentation
COMMENT ON COLUMN public.distributor_contacts.is_active IS 'Whether the contact is active or inactive';
COMMENT ON COLUMN public.distributor_contacts.seniority IS 'Seniority level: entry, mid, senior, executive, c-level';
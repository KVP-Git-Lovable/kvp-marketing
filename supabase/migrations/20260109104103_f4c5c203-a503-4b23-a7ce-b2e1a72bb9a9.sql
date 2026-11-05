-- Add owner_id and owner_name columns to retailers table
-- owner_id references profiles.id for lookup functionality
-- owner_name stores the denormalized name for display

-- First check if columns already exist (from partial previous migration)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='retailers' AND column_name='owner_id') THEN
    ALTER TABLE public.retailers ADD COLUMN owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='retailers' AND column_name='owner_name') THEN
    ALTER TABLE public.retailers ADD COLUMN owner_name text;
  END IF;
END $$;

-- Set existing retailers' owner to their creator (user_id) - but only where user_id exists in profiles
UPDATE public.retailers r
SET owner_id = r.user_id,
    owner_name = p.full_name
FROM public.profiles p
WHERE r.user_id = p.id 
  AND r.owner_id IS NULL;

-- For retailers with invalid user_id (not in profiles), leave owner_id as NULL
-- This handles the case where user_id = '00000000-0000-0000-0000-000000000000'

-- Create index for faster owner lookups
CREATE INDEX IF NOT EXISTS idx_retailers_owner_id ON public.retailers(owner_id);
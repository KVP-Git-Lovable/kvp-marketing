-- Add entity_type to retailers for classifying retailer, distributor, super stockist
ALTER TABLE public.retailers
ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'retailer';

-- Restrict allowed values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_retailers_entity_type'
  ) THEN
    ALTER TABLE public.retailers
    ADD CONSTRAINT chk_retailers_entity_type
    CHECK (entity_type IN ('retailer','distributor','super_stockist'));
  END IF;
END $$;

-- Index for faster filtering
CREATE INDEX IF NOT EXISTS idx_retailers_entity_type ON public.retailers(entity_type);

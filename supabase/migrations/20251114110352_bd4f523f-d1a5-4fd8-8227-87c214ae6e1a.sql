-- Enforce only the 4 official invoice templates and purge any custom/test templates

-- 1) Backfill invalid or null company invoice_template to 'template4'
UPDATE public.companies
SET invoice_template = 'template4'
WHERE invoice_template IS NULL
   OR invoice_template NOT IN ('template1','template2','template3','template4');

-- 2) Set default to 'template4'
ALTER TABLE public.companies
ALTER COLUMN invoice_template SET DEFAULT 'template4';

-- 3) Add a CHECK constraint to restrict values to the 4 official templates (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'companies_invoice_template_valid'
  ) THEN
    ALTER TABLE public.companies
    ADD CONSTRAINT companies_invoice_template_valid
    CHECK (invoice_template IN ('template1','template2','template3','template4'));
  END IF;
END $$;

-- 4) Remove any custom/test templates if the table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'custom_invoice_templates'
  ) THEN
    DELETE FROM public.custom_invoice_templates; -- Purge all rows
  END IF;
END $$;
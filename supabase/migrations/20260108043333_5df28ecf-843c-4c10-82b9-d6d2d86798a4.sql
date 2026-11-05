-- Add separate fields for header branding (display purposes only)
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS header_name TEXT,
ADD COLUMN IF NOT EXISTS header_logo_url TEXT;

-- Add comment to clarify purpose
COMMENT ON COLUMN public.companies.header_name IS 'Display name for navbar/header, separate from official company name';
COMMENT ON COLUMN public.companies.header_logo_url IS 'Logo for navbar/header display, separate from official company logo';
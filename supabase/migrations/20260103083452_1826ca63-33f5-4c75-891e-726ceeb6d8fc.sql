-- Add contact_name and contact_title columns to retailers table
ALTER TABLE public.retailers 
ADD COLUMN contact_name TEXT,
ADD COLUMN contact_title TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.retailers.contact_name IS 'Name of the contact person at the retailer';
COMMENT ON COLUMN public.retailers.contact_title IS 'Title/role of the contact person (e.g., Shop owner, Support staff, Family member, Others)';
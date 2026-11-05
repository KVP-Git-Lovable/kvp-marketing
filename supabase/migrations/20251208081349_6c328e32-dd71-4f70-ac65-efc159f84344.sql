-- Add visit_type column to visits table to handle legacy cached data from older app versions
-- This allows offline sync to work without errors when old cached visits have this field

ALTER TABLE public.visits 
ADD COLUMN IF NOT EXISTS visit_type text;

-- Add a comment explaining this column
COMMENT ON COLUMN public.visits.visit_type IS 'Legacy field added for backward compatibility with older app versions. May contain values like "Planned" from cached data.';
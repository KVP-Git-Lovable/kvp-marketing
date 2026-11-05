-- Add skip check-in columns to visits table
ALTER TABLE visits 
ADD COLUMN IF NOT EXISTS skip_check_in_reason TEXT,
ADD COLUMN IF NOT EXISTS skip_check_in_time TIMESTAMPTZ;
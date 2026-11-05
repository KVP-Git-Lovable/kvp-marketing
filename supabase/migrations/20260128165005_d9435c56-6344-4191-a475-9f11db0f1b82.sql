-- Add new columns for target plan name and lock status
ALTER TABLE fy_target_config
ADD COLUMN IF NOT EXISTS target_plan_name TEXT DEFAULT 'FY Sales Plan',
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
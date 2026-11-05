-- Add columns to fy_target_config for FY-wide targets and setup tracking
ALTER TABLE fy_target_config 
ADD COLUMN IF NOT EXISTS total_quantity_target NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_revenue_target NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_visits_target INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN DEFAULT false;
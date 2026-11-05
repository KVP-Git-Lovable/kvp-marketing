-- Update performance_module_config to support 'both' option
-- Add check constraint to allow 'both' as a valid option
ALTER TABLE performance_module_config 
DROP CONSTRAINT IF EXISTS performance_module_config_active_module_check;

ALTER TABLE performance_module_config 
ADD CONSTRAINT performance_module_config_active_module_check 
CHECK (active_module IN ('none', 'gamification', 'target_actual', 'both'));

-- Create sample data for demonstration purposes in user_performance_scores
-- This creates sample performance data for testing when no real data exists
-- Note: This is for demonstration only and should be replaced with actual calculated data

COMMENT ON TABLE user_performance_scores IS 'Stores aggregated performance scores for users across different time periods. The kpi_scores JSONB field contains individual KPI achievement percentages.';
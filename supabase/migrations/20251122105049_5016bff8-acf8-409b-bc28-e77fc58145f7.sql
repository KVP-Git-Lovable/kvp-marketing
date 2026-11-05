-- Add new AI scoring parameter fields to credit_management_config table
ALTER TABLE credit_management_config
ADD COLUMN IF NOT EXISTS target_growth_rate_percent numeric DEFAULT 10.0,
ADD COLUMN IF NOT EXISTS target_order_frequency numeric DEFAULT 2.0;

COMMENT ON COLUMN credit_management_config.target_growth_rate_percent IS 'Expected growth rate percentage over the lookback period';
COMMENT ON COLUMN credit_management_config.target_order_frequency IS 'Expected orders per X number of visits (e.g., 1 order every 2 visits = 2)';
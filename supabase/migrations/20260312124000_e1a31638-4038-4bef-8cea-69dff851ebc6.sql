
ALTER TABLE fy_target_config 
  ADD COLUMN IF NOT EXISTS enable_retailer_activation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_retailer_activation_target numeric DEFAULT 0;

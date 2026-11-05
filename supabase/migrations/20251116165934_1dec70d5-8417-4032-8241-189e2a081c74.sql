-- Add territory support and multi-record capability to credit_management_config
ALTER TABLE credit_management_config
ADD COLUMN IF NOT EXISTS territory_ids text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS config_name text;

-- Add index for territory lookups
CREATE INDEX IF NOT EXISTS idx_credit_config_territories ON credit_management_config USING GIN (territory_ids);

-- Add constraint to ensure territory_ids is not null
ALTER TABLE credit_management_config
ALTER COLUMN territory_ids SET NOT NULL,
ALTER COLUMN territory_ids SET DEFAULT '{}';

-- Update existing record if it exists (migrate old data)
UPDATE credit_management_config
SET territory_ids = '{}', 
    is_active = true,
    config_name = 'Default Configuration'
WHERE territory_ids IS NULL OR cardinality(territory_ids) = 0;
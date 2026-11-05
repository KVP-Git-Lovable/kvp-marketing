-- Add credit management feature flag
INSERT INTO feature_flags (feature_key, feature_name, category, description, is_enabled)
VALUES (
  'credit_management',
  'Credit Management',
  'Financial',
  'Enable credit scoring and limit management for retailers',
  true
)
ON CONFLICT (feature_key) DO UPDATE
SET 
  feature_name = EXCLUDED.feature_name,
  category = EXCLUDED.category,
  description = EXCLUDED.description;
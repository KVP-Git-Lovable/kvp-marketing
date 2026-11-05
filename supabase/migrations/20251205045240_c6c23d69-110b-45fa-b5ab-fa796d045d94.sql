-- Add Van Sales feature flag to feature_flags table
INSERT INTO public.feature_flags (feature_key, feature_name, description, category, is_enabled, created_at, updated_at)
VALUES (
  'van_sales',
  'Van Sales Module',
  'Enable or disable van sales module for all users. When enabled, users can manage van stock, track inventory, and record deliveries from My Visits.',
  'Operations',
  true,
  now(),
  now()
)
ON CONFLICT (feature_key) DO UPDATE SET
  feature_name = EXCLUDED.feature_name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = now();
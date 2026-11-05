-- Add location options feature flag
INSERT INTO feature_flags (
  feature_key,
  feature_name,
  description,
  category,
  is_enabled,
  created_at,
  updated_at
) VALUES (
  'location_check_in_enabled',
  'Location Check-in/Check-out',
  'Enable or disable location-based check-in and check-out functionality across the application',
  'Location',
  true,
  now(),
  now()
) ON CONFLICT (feature_key) DO NOTHING;
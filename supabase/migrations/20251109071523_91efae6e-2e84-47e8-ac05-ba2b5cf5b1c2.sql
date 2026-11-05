-- Add feature flag for check-in mandatory setting
INSERT INTO feature_flags (feature_key, feature_name, description, is_enabled, category)
VALUES (
  'check_in_mandatory_for_order',
  'Mandatory Check-In for Order Entry',
  'When enabled, users must check-in to a visit before accessing the order entry page. When disabled, users can access order entry directly without check-in.',
  false,
  'order_management'
)
ON CONFLICT (feature_key) DO NOTHING;

-- Seed new Retailer Ext DB and expanded Pincode Master permission keys for System Administrator
INSERT INTO profile_object_permissions (profile_id, object_name, permission_type, can_create, can_read, can_edit, can_delete)
SELECT p.id, v.object_name, v.permission_type, true, true, true, true
FROM security_profiles p
CROSS JOIN (VALUES
  -- Pincode Master expanded fields
  ('field_admin_pincode_district', 'field'),
  ('field_admin_pincode_state', 'field'),
  -- Retailer Ext DB fields
  ('field_admin_retailer_ext_state', 'field'),
  ('field_admin_retailer_ext_city', 'field'),
  ('field_admin_retailer_ext_company', 'field'),
  ('field_admin_retailer_ext_category', 'field'),
  -- Retailer Ext DB actions
  ('action_admin_retailer_ext_search', 'action'),
  ('action_admin_retailer_ext_export', 'action'),
  -- Retailer Ext DB widgets
  ('widget_admin_retailer_ext_list', 'widget'),
  ('widget_admin_retailer_ext_detail', 'widget')
) AS v(object_name, permission_type)
WHERE p.name = 'System Administrator'
ON CONFLICT (profile_id, object_name, permission_type) DO NOTHING;

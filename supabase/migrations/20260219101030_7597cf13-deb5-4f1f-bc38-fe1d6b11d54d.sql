-- Seed missing permission objects for System Administrator profile
INSERT INTO profile_object_permissions (profile_id, object_name, can_read, can_create, can_edit, can_delete, can_view_all, can_modify_all)
VALUES
  ('3385dd99-c4f7-455b-94d7-c7b5105565ce', 'admin_pincode_master', true, true, true, true, true, true),
  ('3385dd99-c4f7-455b-94d7-c7b5105565ce', 'admin_tax_master', true, true, true, true, true, true),
  ('3385dd99-c4f7-455b-94d7-c7b5105565ce', 'admin_system_settings', true, true, true, true, true, true),
  ('3385dd99-c4f7-455b-94d7-c7b5105565ce', 'admin_user_mgmt', true, true, true, true, true, true)
ON CONFLICT (profile_id, object_name) DO NOTHING;
-- Insert Tax Master permission objects for System Administrator
INSERT INTO public.profile_object_permissions (profile_id, object_name, can_read, can_create, can_edit, can_delete, can_view_all, can_modify_all)
VALUES
  ('3385dd99-c4f7-455b-94d7-c7b5105565ce', 'tax_master_list', true, true, true, true, true, true),
  ('3385dd99-c4f7-455b-94d7-c7b5105565ce', 'tax_master_create', true, true, true, true, true, true),
  ('3385dd99-c4f7-455b-94d7-c7b5105565ce', 'tax_master_edit', true, true, true, true, true, true),
  ('3385dd99-c4f7-455b-94d7-c7b5105565ce', 'tax_master_delete', true, true, true, true, true, true),
  ('3385dd99-c4f7-455b-94d7-c7b5105565ce', 'tax_component_manage', true, true, true, true, true, true),
  ('3385dd99-c4f7-455b-94d7-c7b5105565ce', 'tax_product_mapping', true, true, true, true, true, true),
  -- Insert User Management permission objects for System Administrator
  ('3385dd99-c4f7-455b-94d7-c7b5105565ce', 'user_mgmt_list', true, true, true, true, true, true),
  ('3385dd99-c4f7-455b-94d7-c7b5105565ce', 'user_mgmt_create', true, true, true, true, true, true),
  ('3385dd99-c4f7-455b-94d7-c7b5105565ce', 'user_mgmt_edit', true, true, true, true, true, true),
  ('3385dd99-c4f7-455b-94d7-c7b5105565ce', 'user_mgmt_delete', true, true, true, true, true, true),
  ('3385dd99-c4f7-455b-94d7-c7b5105565ce', 'user_mgmt_activate_deactivate', true, true, true, true, true, true),
  ('3385dd99-c4f7-455b-94d7-c7b5105565ce', 'user_mgmt_reset_password', true, true, true, true, true, true),
  ('3385dd99-c4f7-455b-94d7-c7b5105565ce', 'user_mgmt_hierarchy', true, true, true, true, true, true)
ON CONFLICT (profile_id, object_name) DO NOTHING;
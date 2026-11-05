INSERT INTO profile_object_permissions (profile_id, object_name, can_read, can_create, can_edit, can_delete)
VALUES 
  ('3385dd99-c4f7-455b-94d7-c7b5105565ce', 'admin_retailer_ext_db', true, true, true, true),
  ('57b733d2-4325-47f2-893d-40fc604e4329', 'admin_retailer_ext_db', true, false, false, false)
ON CONFLICT DO NOTHING;
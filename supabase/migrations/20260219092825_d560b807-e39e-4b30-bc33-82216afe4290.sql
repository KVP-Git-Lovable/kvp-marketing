
-- Seed all permissions for System Administrator profile
-- This ensures the System Admin can access everything via the permission-based architecture
INSERT INTO profile_object_permissions (profile_id, object_name, can_read, can_create, can_edit, can_delete, can_view_all, can_modify_all)
SELECT 
  '3385dd99-c4f7-455b-94d7-c7b5105565ce',
  obj.object_name,
  true, true, true, true, true, true
FROM (SELECT DISTINCT object_name FROM profile_object_permissions) obj
ON CONFLICT (profile_id, object_name) DO UPDATE SET
  can_read = true, can_create = true, can_edit = true, can_delete = true, can_view_all = true, can_modify_all = true;

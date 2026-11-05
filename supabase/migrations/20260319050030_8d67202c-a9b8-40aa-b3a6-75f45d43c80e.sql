-- Auto-seed System Administrator permissions trigger
-- When any profile gets a new permission row, ensure the system admin profile also has it with full access

CREATE OR REPLACE FUNCTION public.auto_seed_system_admin_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Skip if the inserting profile is already a system profile
  IF EXISTS (SELECT 1 FROM security_profiles WHERE id = NEW.profile_id AND is_system = true) THEN
    RETURN NEW;
  END IF;

  -- Auto-insert for all system admin profiles if not already present
  INSERT INTO profile_object_permissions (
    profile_id, object_name, permission_type, parent_module,
    can_read, can_create, can_edit, can_delete, can_view_all, can_modify_all
  )
  SELECT
    sp.id, NEW.object_name, NEW.permission_type, NEW.parent_module,
    true, true, true, true, true, true
  FROM security_profiles sp
  WHERE sp.is_system = true
    AND NOT EXISTS (
      SELECT 1 FROM profile_object_permissions pop
      WHERE pop.profile_id = sp.id
        AND pop.object_name = NEW.object_name
        AND pop.permission_type = NEW.permission_type
    );

  RETURN NEW;
END;
$$;

-- Drop trigger if exists to avoid conflicts
DROP TRIGGER IF EXISTS trg_auto_seed_system_admin ON profile_object_permissions;

CREATE TRIGGER trg_auto_seed_system_admin
  AFTER INSERT ON profile_object_permissions
  FOR EACH ROW
  EXECUTE FUNCTION auto_seed_system_admin_permissions();
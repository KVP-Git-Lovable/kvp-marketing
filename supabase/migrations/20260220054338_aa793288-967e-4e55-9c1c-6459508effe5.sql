
-- Add permission_type column to distinguish 4 layers
ALTER TABLE profile_object_permissions 
ADD COLUMN IF NOT EXISTS permission_type text NOT NULL DEFAULT 'feature';

-- Add parent_module column to link children to their parent module
ALTER TABLE profile_object_permissions 
ADD COLUMN IF NOT EXISTS parent_module text;

-- Drop old unique constraint and create new one including permission_type
ALTER TABLE profile_object_permissions 
DROP CONSTRAINT IF EXISTS profile_object_permissions_profile_id_object_name_key;

ALTER TABLE profile_object_permissions 
ADD CONSTRAINT profile_object_permissions_profile_id_object_name_type_key 
UNIQUE (profile_id, object_name, permission_type);

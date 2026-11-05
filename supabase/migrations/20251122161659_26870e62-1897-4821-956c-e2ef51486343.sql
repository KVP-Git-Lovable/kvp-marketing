-- Create simplified RBAC system with profiles and object permissions

-- 1. Security Profiles table
CREATE TABLE IF NOT EXISTS security_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. User to Profile mapping (one profile per user)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES security_profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 3. Object-level permissions per profile
CREATE TABLE IF NOT EXISTS profile_object_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES security_profiles(id) ON DELETE CASCADE,
  object_name TEXT NOT NULL,
  can_read BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_view_all BOOLEAN DEFAULT false,
  can_modify_all BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, object_name)
);

-- 4. Function to get all subordinate users based on manager hierarchy
CREATE OR REPLACE FUNCTION get_subordinate_users(user_id_param UUID)
RETURNS TABLE(subordinate_user_id UUID)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE subordinates AS (
    -- Start with direct reports
    SELECT e.user_id as subordinate_user_id
    FROM employees e
    WHERE e.manager_id = user_id_param
    
    UNION ALL
    
    -- Recursively get reports of reports
    SELECT e.user_id
    FROM employees e
    INNER JOIN subordinates s ON e.manager_id = s.subordinate_user_id
  )
  SELECT subordinate_user_id FROM subordinates;
$$;

-- 5. Function to check object-level access
CREATE OR REPLACE FUNCTION can_access_object(
  user_id_param UUID,
  object_name_param TEXT,
  permission_type TEXT
)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_permission BOOLEAN := false;
  is_admin BOOLEAN;
BEGIN
  -- Admins have full access
  SELECT has_role(user_id_param, 'admin'::app_role) INTO is_admin;
  IF is_admin THEN
    RETURN true;
  END IF;
  
  -- Check profile permissions
  SELECT CASE permission_type
    WHEN 'read' THEN COALESCE(pop.can_read, false)
    WHEN 'create' THEN COALESCE(pop.can_create, false)
    WHEN 'edit' THEN COALESCE(pop.can_edit, false)
    WHEN 'delete' THEN COALESCE(pop.can_delete, false)
    WHEN 'view_all' THEN COALESCE(pop.can_view_all, false)
    WHEN 'modify_all' THEN COALESCE(pop.can_modify_all, false)
    ELSE false
  END INTO has_permission
  FROM profile_object_permissions pop
  JOIN user_profiles up ON up.profile_id = pop.profile_id
  WHERE up.user_id = user_id_param
    AND pop.object_name = object_name_param;
  
  RETURN COALESCE(has_permission, false);
END;
$$;

-- 6. Insert default profiles
INSERT INTO security_profiles (name, description, is_system) VALUES
('System Administrator', 'Full system access to all features and data', true),
('Sales Manager', 'Can view team data and manage team operations', true),
('Field Sales Executive', 'Can create orders, visits, and manage retailers', true),
('Data Viewer', 'Read-only access to reports and analytics', true)
ON CONFLICT (name) DO NOTHING;

-- 7. Set up default permissions for System Administrator
INSERT INTO profile_object_permissions (profile_id, object_name, can_read, can_create, can_edit, can_delete, can_view_all, can_modify_all)
SELECT 
  (SELECT id FROM security_profiles WHERE name = 'System Administrator'),
  object_name,
  true, true, true, true, true, true
FROM (VALUES 
  ('retailers'), ('orders'), ('visits'), ('products'), ('territories'),
  ('attendance'), ('expenses'), ('beats'), ('distributors'), ('invoices')
) AS objects(object_name)
ON CONFLICT (profile_id, object_name) DO NOTHING;

-- 8. Set up default permissions for Sales Manager
INSERT INTO profile_object_permissions (profile_id, object_name, can_read, can_create, can_edit, can_delete, can_view_all, can_modify_all)
SELECT 
  (SELECT id FROM security_profiles WHERE name = 'Sales Manager'),
  object_name,
  can_read, can_create, can_edit, can_delete, can_view_all, can_modify_all
FROM (VALUES 
  ('retailers', true, true, true, false, true, false),
  ('orders', true, true, true, false, true, false),
  ('visits', true, true, true, false, true, false),
  ('products', true, false, false, false, true, false),
  ('territories', true, false, false, false, true, false),
  ('attendance', true, false, false, false, true, false),
  ('expenses', true, false, true, false, true, false),
  ('beats', true, true, true, true, true, true),
  ('distributors', true, true, true, false, true, false),
  ('invoices', true, true, true, false, true, false)
) AS perms(object_name, can_read, can_create, can_edit, can_delete, can_view_all, can_modify_all)
ON CONFLICT (profile_id, object_name) DO NOTHING;

-- 9. Set up default permissions for Field Sales Executive
INSERT INTO profile_object_permissions (profile_id, object_name, can_read, can_create, can_edit, can_delete, can_view_all, can_modify_all)
SELECT 
  (SELECT id FROM security_profiles WHERE name = 'Field Sales Executive'),
  object_name,
  can_read, can_create, can_edit, can_delete, can_view_all, can_modify_all
FROM (VALUES 
  ('retailers', true, true, true, false, false, false),
  ('orders', true, true, true, false, false, false),
  ('visits', true, true, true, false, false, false),
  ('products', true, false, false, false, true, false),
  ('territories', true, false, false, false, false, false),
  ('attendance', true, true, false, false, false, false),
  ('expenses', true, true, true, false, false, false),
  ('beats', true, false, false, false, false, false),
  ('distributors', true, false, false, false, false, false),
  ('invoices', true, false, false, false, false, false)
) AS perms(object_name, can_read, can_create, can_edit, can_delete, can_view_all, can_modify_all)
ON CONFLICT (profile_id, object_name) DO NOTHING;

-- 10. Set up default permissions for Data Viewer
INSERT INTO profile_object_permissions (profile_id, object_name, can_read, can_create, can_edit, can_delete, can_view_all, can_modify_all)
SELECT 
  (SELECT id FROM security_profiles WHERE name = 'Data Viewer'),
  object_name,
  true, false, false, false, true, false
FROM (VALUES 
  ('retailers'), ('orders'), ('visits'), ('products'), ('territories'),
  ('attendance'), ('expenses'), ('beats'), ('distributors'), ('invoices')
) AS objects(object_name)
ON CONFLICT (profile_id, object_name) DO NOTHING;

-- 11. Enable RLS on new tables
ALTER TABLE security_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_object_permissions ENABLE ROW LEVEL SECURITY;

-- 12. RLS Policies for security_profiles
CREATE POLICY "Anyone can view profiles"
ON security_profiles FOR SELECT
USING (true);

CREATE POLICY "Only admins can manage profiles"
ON security_profiles FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 13. RLS Policies for user_profiles
CREATE POLICY "Users can view their own profile assignment"
ON user_profiles FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can manage profile assignments"
ON user_profiles FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 14. RLS Policies for profile_object_permissions
CREATE POLICY "Users can view permissions for their profile"
ON profile_object_permissions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.user_id = auth.uid() AND up.profile_id = profile_object_permissions.profile_id
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Only admins can manage permissions"
ON profile_object_permissions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 15. Migrate existing users to default profiles based on their current role
INSERT INTO user_profiles (user_id, profile_id)
SELECT 
  ur.user_id,
  CASE 
    WHEN ur.role = 'admin' THEN (SELECT id FROM security_profiles WHERE name = 'System Administrator')
    ELSE (SELECT id FROM security_profiles WHERE name = 'Field Sales Executive')
  END
FROM user_roles ur
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles up WHERE up.user_id = ur.user_id
)
ON CONFLICT (user_id) DO NOTHING;
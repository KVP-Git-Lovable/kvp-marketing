-- Create user-specific object permissions table (overrides profile permissions)
CREATE TABLE IF NOT EXISTS user_object_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  object_name TEXT NOT NULL,
  can_read BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_view_all BOOLEAN DEFAULT false,
  can_modify_all BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, object_name)
);

-- Enable RLS
ALTER TABLE user_object_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage user-specific permissions
CREATE POLICY "Admins can manage user permissions"
ON user_object_permissions
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Users can read their own permissions
CREATE POLICY "Users can read own permissions"
ON user_object_permissions
FOR SELECT
USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_user_object_permissions_updated_at
BEFORE UPDATE ON user_object_permissions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
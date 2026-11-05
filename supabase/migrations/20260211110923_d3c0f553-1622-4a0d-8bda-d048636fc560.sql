
-- 1. Make Abhishek KP an admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('6be7e2ff-0447-44a0-a3b5-64993b9db54d', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Create the 5 security profiles for the role dropdown
INSERT INTO public.security_profiles (name, description, is_system) VALUES
  ('Data Viewer', 'Read-only access to view data', false),
  ('Field Sales Executive', 'Field sales team member with standard access', false),
  ('Product Manager', 'Product management access and controls', false),
  ('Sales Manager', 'Sales team management and reporting access', false),
  ('System Administrator', 'Full system administration access', true)
ON CONFLICT DO NOTHING;

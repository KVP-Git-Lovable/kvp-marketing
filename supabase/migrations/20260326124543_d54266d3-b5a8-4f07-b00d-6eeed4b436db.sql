-- Fix: profiles table has RLS enabled but no policies → users can't read own profile
-- Add policy: users can read their own profile row
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Add policy: system admins can read all profiles
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_system_admin(auth.uid()));

-- Add policy: users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Fix: profile_object_permissions has RLS enabled but no policies → permissions never load
-- Users should read permissions for their own assigned profile
CREATE POLICY "Users can read own profile permissions"
  ON public.profile_object_permissions FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT up.profile_id FROM user_profiles up WHERE up.user_id = auth.uid()
    )
  );

-- Admins can read all permissions (for security management UI)
CREATE POLICY "Admins can read all permissions"
  ON public.profile_object_permissions FOR SELECT
  TO authenticated
  USING (public.is_system_admin(auth.uid()));

-- Admins can manage permissions
CREATE POLICY "Admins can manage permissions"
  ON public.profile_object_permissions FOR ALL
  TO authenticated
  USING (public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()));
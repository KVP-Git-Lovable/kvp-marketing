-- Add voice_note_urls to competition_data table
ALTER TABLE competition_data ADD COLUMN voice_note_urls text[] DEFAULT '{}';

-- Update RLS policies for competition_master to allow users to create but not delete
DROP POLICY IF EXISTS "Admins can manage competition_master" ON competition_master;
DROP POLICY IF EXISTS "Users can view competition_master" ON competition_master;

-- Allow all authenticated users to view competition master
CREATE POLICY "Users can view competition_master"
ON competition_master FOR SELECT
TO authenticated
USING (true);

-- Allow all authenticated users to create competitors
CREATE POLICY "Users can create competition_master"
ON competition_master FOR INSERT
TO authenticated
WITH CHECK (true);

-- Only admins can update
CREATE POLICY "Admins can update competition_master"
ON competition_master FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Only admins can delete
CREATE POLICY "Admins can delete competition_master"
ON competition_master FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Similar policies for competition_skus
DROP POLICY IF EXISTS "Admins can manage competition_skus" ON competition_skus;
DROP POLICY IF EXISTS "Users can view competition_skus" ON competition_skus;

CREATE POLICY "Users can view competition_skus"
ON competition_skus FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create competition_skus"
ON competition_skus FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can update competition_skus"
ON competition_skus FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete competition_skus"
ON competition_skus FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Similar policies for competition_contacts
DROP POLICY IF EXISTS "Admins can manage competition_contacts" ON competition_contacts;
DROP POLICY IF EXISTS "Users can view competition_contacts" ON competition_contacts;

CREATE POLICY "Users can view competition_contacts"
ON competition_contacts FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can create competition_contacts"
ON competition_contacts FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can update competition_contacts"
ON competition_contacts FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete competition_contacts"
ON competition_contacts FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);
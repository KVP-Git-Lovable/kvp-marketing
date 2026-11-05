
-- Drop the restrictive policies and replace with permission-aware ones
DROP POLICY IF EXISTS "System admins can manage employees" ON public.employees;
DROP POLICY IF EXISTS "Users can update their own employee record" ON public.employees;

-- New: Allow updates if user is system admin OR has admin_user permission OR is updating own record
CREATE POLICY "Users or permitted admins can update employees"
ON public.employees
FOR UPDATE
USING (
  auth.uid() = user_id
  OR is_system_admin(auth.uid())
  OR can_access_object(auth.uid(), 'admin_user_list', 'edit')
)
WITH CHECK (
  auth.uid() = user_id
  OR is_system_admin(auth.uid())
  OR can_access_object(auth.uid(), 'admin_user_list', 'edit')
);

-- New: Allow insert if system admin or has create permission or own record
CREATE POLICY "Users or permitted admins can insert employees"
ON public.employees
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR is_system_admin(auth.uid())
  OR can_access_object(auth.uid(), 'admin_user_create', 'create')
);

-- New: Allow delete if system admin or has delete permission
CREATE POLICY "Permitted admins can delete employees"
ON public.employees
FOR DELETE
USING (
  is_system_admin(auth.uid())
  OR can_access_object(auth.uid(), 'admin_user_delete', 'delete')
);

-- Drop old insert policy (replaced above)
DROP POLICY IF EXISTS "Users can insert their own employee record" ON public.employees;

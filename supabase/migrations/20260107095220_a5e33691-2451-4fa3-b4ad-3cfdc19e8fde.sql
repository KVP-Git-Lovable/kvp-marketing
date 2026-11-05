-- Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
$$;

-- Add policy for admins to view all business plans
CREATE POLICY "Admins can view all business plans"
ON public.user_business_plans
FOR SELECT
USING (public.is_admin_or_manager());

-- Add policy for admins to create business plans for any user
CREATE POLICY "Admins can create business plans for any user"
ON public.user_business_plans
FOR INSERT
WITH CHECK (public.is_admin_or_manager());

-- Add policy for admins to update any business plans
CREATE POLICY "Admins can update any business plans"
ON public.user_business_plans
FOR UPDATE
USING (public.is_admin_or_manager());

-- Add policy for admins to delete any business plans
CREATE POLICY "Admins can delete any business plans"
ON public.user_business_plans
FOR DELETE
USING (public.is_admin_or_manager());
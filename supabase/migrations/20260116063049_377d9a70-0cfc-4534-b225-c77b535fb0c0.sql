-- Allow admins to update user status on any profile
CREATE POLICY "Admins can update user status" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
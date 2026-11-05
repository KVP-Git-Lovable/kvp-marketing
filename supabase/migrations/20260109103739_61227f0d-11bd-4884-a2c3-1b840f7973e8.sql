-- Allow admins to view all beat plans (needed for Analytics cross-user reporting)
-- Beat plans can contain sensitive route details, so keep this restricted to admins.

CREATE POLICY "Admins can view all beat plans"
ON public.beat_plans
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));
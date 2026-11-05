
-- Allow managers to view subordinate beat_plans
CREATE POLICY "Managers can view subordinate beat_plans"
ON public.beat_plans
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT subordinate_user_id 
    FROM public.get_all_subordinates(auth.uid())
  )
);

-- Allow system admins to view all beat_plans
CREATE POLICY "Admins can view all beat_plans"
ON public.beat_plans
FOR SELECT
TO authenticated
USING (public.is_system_admin(auth.uid()));

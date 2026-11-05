-- Allow managers to view attendance of their subordinates
CREATE POLICY "Managers can view subordinate attendance"
ON public.attendance
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT subordinate_user_id 
    FROM public.get_all_subordinates(auth.uid())
  )
);
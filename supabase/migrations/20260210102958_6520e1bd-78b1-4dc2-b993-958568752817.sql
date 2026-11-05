CREATE POLICY "Managers can view subordinates GPS tracking"
  ON public.gps_tracking
  FOR SELECT
  USING (
    user_id IN (
      SELECT subordinate_user_id
      FROM get_all_subordinates(auth.uid())
    )
  );
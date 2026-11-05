CREATE POLICY "Managers can view team beat plans"
ON public.beat_plans FOR SELECT TO authenticated
USING (
  public.is_subordinate_of(auth.uid(), user_id)
  OR public.user_has_permission(auth.uid(), 'module_visits', 'can_view_all')
);
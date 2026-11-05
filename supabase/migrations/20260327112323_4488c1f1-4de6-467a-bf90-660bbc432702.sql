DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'attendance'
      AND policyname = 'Managers can view subordinate attendance'
  ) THEN
    CREATE POLICY "Managers can view subordinate attendance"
    ON public.attendance
    FOR SELECT
    TO authenticated
    USING (public.can_view_employee(user_id));
  END IF;
END
$$;
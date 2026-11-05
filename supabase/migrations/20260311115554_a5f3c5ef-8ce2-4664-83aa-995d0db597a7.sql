-- Fix: Remove status='submitted' restriction from manager UPDATE policy
-- The application code already enforces status checks in the update query
DROP POLICY IF EXISTS "Managers can approve reject subordinate expenses" ON additional_expenses;

CREATE POLICY "Managers can approve reject subordinate expenses"
ON additional_expenses FOR UPDATE TO authenticated
USING (
  user_id IN (
    SELECT subordinate_user_id FROM get_all_subordinates(auth.uid())
    WHERE level > 0
  )
)
WITH CHECK (
  user_id IN (
    SELECT subordinate_user_id FROM get_all_subordinates(auth.uid())
    WHERE level > 0
  )
);

-- Also add a SELECT policy so managers can view subordinate bills in storage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Managers can view subordinate expense bills' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Managers can view subordinate expense bills" ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'expense-bills' AND
      (storage.foldername(name))[1]::uuid IN (
        SELECT subordinate_user_id FROM public.get_all_subordinates(auth.uid())
        WHERE level > 0
      )
    );
  END IF;
END $$;
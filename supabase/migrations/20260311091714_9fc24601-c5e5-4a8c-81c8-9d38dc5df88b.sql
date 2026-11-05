-- Allow users to delete their own submitted expenses (not just draft)
-- Drop old restrictive policy if it exists and recreate
DO $$
BEGIN
  -- Try dropping old delete policy
  BEGIN
    DROP POLICY IF EXISTS "Users can delete own draft expenses" ON additional_expenses;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Users can delete own additional expenses" ON additional_expenses;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Recreate: users can delete their own draft or submitted expenses
CREATE POLICY "Users can delete own draft or submitted expenses"
  ON additional_expenses
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND status IN ('draft', 'submitted')
  );

-- Also allow editing submitted expenses by owner
DO $$
BEGIN
  BEGIN
    DROP POLICY IF EXISTS "Users can update own draft expenses" ON additional_expenses;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

CREATE POLICY "Users can update own draft or submitted expenses"
  ON additional_expenses
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND status IN ('draft', 'submitted')
  )
  WITH CHECK (
    user_id = auth.uid()
    AND status IN ('draft', 'submitted')
  );

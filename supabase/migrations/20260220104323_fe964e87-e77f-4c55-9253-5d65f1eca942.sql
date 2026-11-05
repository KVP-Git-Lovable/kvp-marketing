
-- Fix 5: Add RLS SELECT policies so approvers can read entities in their approval chain

-- Policy for leave_applications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'leave_applications' 
      AND policyname = 'Approvers can view leave applications in their approval chain'
  ) THEN
    CREATE POLICY "Approvers can view leave applications in their approval chain"
    ON public.leave_applications FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM approval_steps ast
        JOIN approval_requests ar ON ar.id = ast.approval_request_id
        WHERE ar.entity_id = leave_applications.id
          AND ar.entity_type = 'leave'
          AND ast.approver_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Policy for regularization_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'regularization_requests' 
      AND policyname = 'Approvers can view regularizations in their approval chain'
  ) THEN
    CREATE POLICY "Approvers can view regularizations in their approval chain"
    ON public.regularization_requests FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM approval_steps ast
        JOIN approval_requests ar ON ar.id = ast.approval_request_id
        WHERE ar.entity_id = regularization_requests.id
          AND ar.entity_type = 'regularization'
          AND ast.approver_id = auth.uid()
      )
    );
  END IF;
END $$;

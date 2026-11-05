-- Repair approval table structure: add PKs, FKs, and indexes
-- This migration adds proper constraints without data loss

-- 1. Add primary keys (only if not already set)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.approval_requests'::regclass 
    AND contype = 'p'
  ) THEN
    ALTER TABLE public.approval_requests ADD PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.approval_steps'::regclass 
    AND contype = 'p'
  ) THEN
    ALTER TABLE public.approval_steps ADD PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.approval_audit_log'::regclass 
    AND contype = 'p'
  ) THEN
    ALTER TABLE public.approval_audit_log ADD PRIMARY KEY (id);
  END IF;
END $$;

-- 2. Add foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.approval_steps'::regclass 
    AND confrelid = 'public.approval_requests'::regclass
    AND contype = 'f'
  ) THEN
    ALTER TABLE public.approval_steps 
      ADD CONSTRAINT fk_approval_steps_request 
      FOREIGN KEY (approval_request_id) 
      REFERENCES public.approval_requests(id) 
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.approval_audit_log'::regclass 
    AND confrelid = 'public.approval_requests'::regclass
    AND contype = 'f'
  ) THEN
    ALTER TABLE public.approval_audit_log 
      ADD CONSTRAINT fk_audit_log_request 
      FOREIGN KEY (approval_request_id) 
      REFERENCES public.approval_requests(id) 
      ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_approval_requests_entity ON public.approval_requests(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON public.approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_requester ON public.approval_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_approval_steps_request ON public.approval_steps(approval_request_id);
CREATE INDEX IF NOT EXISTS idx_approval_steps_approver ON public.approval_steps(approver_id, status);
CREATE INDEX IF NOT EXISTS idx_approval_audit_log_request ON public.approval_audit_log(approval_request_id);

-- 4. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
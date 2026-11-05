
-- 1. Add approval_mode column to approval_config
ALTER TABLE public.approval_config 
ADD COLUMN IF NOT EXISTS approval_mode text NOT NULL DEFAULT 'manager'
CHECK (approval_mode IN ('auto', 'manager', 'multi_level'));

-- 2. Insert expense config row (if not exists)
INSERT INTO public.approval_config (entity_type, max_levels, use_full_hierarchy, skip_levels, approval_mode)
VALUES ('expense', 1, false, false, 'manager')
ON CONFLICT (entity_type) DO NOTHING;

-- 3. Create trigger function for expense submission
CREATE OR REPLACE FUNCTION public.trigger_create_expense_approval_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_approval_mode text;
BEGIN
  -- Only fire on new submissions (status = 'submitted')
  IF NEW.status != 'submitted' THEN
    RETURN NEW;
  END IF;
  
  -- For updates, only fire if status changed to submitted
  IF TG_OP = 'UPDATE' AND OLD.status = 'submitted' THEN
    RETURN NEW;
  END IF;

  -- Check approval mode
  SELECT approval_mode INTO v_approval_mode
  FROM approval_config
  WHERE entity_type = 'expense';

  IF v_approval_mode = 'auto' THEN
    -- Auto-approve: skip approval engine, directly approve
    NEW.status := 'manager_approved';
    NEW.approved_at := now();
    RETURN NEW;
  END IF;

  -- Create approval request through the engine
  PERFORM create_approval_request('expense', NEW.id, NEW.user_id);
  RETURN NEW;
END;
$$;

-- 4. Add trigger on additional_expenses for INSERT and UPDATE
CREATE TRIGGER tr_expense_approval_request
  BEFORE INSERT OR UPDATE ON public.additional_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_create_expense_approval_request();

-- 5. Update trigger_sync_entity_status to handle expenses
CREATE OR REPLACE FUNCTION public.trigger_sync_entity_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    IF NEW.entity_type = 'leave' THEN
      UPDATE leave_applications SET 
        status = 'approved', 
        approved_by = NEW.final_approved_by, 
        approved_date = now(),
        final_approved_by = NEW.final_approved_by
      WHERE id = NEW.entity_id;
    ELSIF NEW.entity_type = 'regularization' THEN
      UPDATE regularization_requests SET 
        status = 'approved', 
        approved_by = NEW.final_approved_by, 
        approved_at = now()
      WHERE id = NEW.entity_id;
    ELSIF NEW.entity_type = 'expense' THEN
      UPDATE additional_expenses SET 
        status = 'manager_approved', 
        approved_by = NEW.final_approved_by, 
        approved_at = now()
      WHERE id = NEW.entity_id;
    END IF;
  ELSIF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
    IF NEW.entity_type = 'leave' THEN
      UPDATE leave_applications SET status = 'rejected' WHERE id = NEW.entity_id;
    ELSIF NEW.entity_type = 'regularization' THEN
      UPDATE regularization_requests SET status = 'rejected' WHERE id = NEW.entity_id;
    ELSIF NEW.entity_type = 'expense' THEN
      UPDATE additional_expenses SET 
        status = 'rejected',
        rejection_reason = (
          SELECT rejection_reason FROM approval_steps 
          WHERE approval_request_id = NEW.id AND status = 'rejected' 
          LIMIT 1
        )
      WHERE id = NEW.entity_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

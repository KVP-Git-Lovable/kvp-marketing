
-- ============================================
-- Phase 1: Expense Categories
-- ============================================
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  receipt_required boolean NOT NULL DEFAULT false,
  limit_amount numeric DEFAULT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

-- Everyone can read categories
CREATE POLICY "Anyone authenticated can read expense_categories"
  ON public.expense_categories FOR SELECT TO authenticated
  USING (true);

-- Only admins can modify
CREATE POLICY "Admins can manage expense_categories"
  ON public.expense_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Seed default categories
INSERT INTO public.expense_categories (name, receipt_required, limit_amount, sort_order) VALUES
  ('Telephone Expense', false, NULL, 1),
  ('Outlocation travel', true, NULL, 2),
  ('Toll / Parking', true, NULL, 3),
  ('Lodging / Stay', true, NULL, 4),
  ('Food / Meals', true, NULL, 5),
  ('Courier / Postage', true, NULL, 6),
  ('Printing / Stationery', true, NULL, 7),
  ('Miscellaneous', false, NULL, 8);

-- ============================================
-- Phase 2: Approval Workflows
-- ============================================
CREATE TABLE public.approval_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_name text NOT NULL,
  entity_type text NOT NULL DEFAULT 'expense',
  approval_mode text NOT NULL DEFAULT 'sequential' CHECK (approval_mode IN ('sequential', 'parallel_any', 'parallel_all')),
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read approval_workflows"
  ON public.approval_workflows FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage approval_workflows"
  ON public.approval_workflows FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Seed a default Manager Approval workflow
INSERT INTO public.approval_workflows (workflow_name, entity_type, approval_mode, is_default) VALUES
  ('Manager Approval', 'expense', 'sequential', true);

-- ============================================
-- Phase 2b: Workflow Steps
-- ============================================
CREATE TABLE public.workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES public.approval_workflows(id) ON DELETE CASCADE,
  step_number integer NOT NULL DEFAULT 1,
  approver_type text NOT NULL DEFAULT 'manager' CHECK (approver_type IN ('manager', 'specific_user', 'hierarchy_level')),
  approver_role text DEFAULT NULL,
  specific_user_id uuid DEFAULT NULL REFERENCES auth.users(id),
  hierarchy_level integer DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, step_number)
);

ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read workflow_steps"
  ON public.workflow_steps FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage workflow_steps"
  ON public.workflow_steps FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Seed default step: Manager (Level 1)
INSERT INTO public.workflow_steps (workflow_id, step_number, approver_type, hierarchy_level)
SELECT id, 1, 'manager', 1 FROM public.approval_workflows WHERE is_default = true AND entity_type = 'expense' LIMIT 1;

-- ============================================
-- Phase 3: Expense Approval Rules
-- ============================================
CREATE TABLE public.expense_approval_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_name text NOT NULL,
  condition_type text NOT NULL CHECK (condition_type IN ('amount_range', 'category', 'always')),
  condition_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  workflow_id uuid NOT NULL REFERENCES public.approval_workflows(id) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_approval_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read expense_approval_rules"
  ON public.expense_approval_rules FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage expense_approval_rules"
  ON public.expense_approval_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================
-- Phase 4: Updated Trigger — Rule-based workflow resolution
-- ============================================
CREATE OR REPLACE FUNCTION public.trigger_create_expense_approval_request()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_workflow_id uuid;
  v_workflow RECORD;
  v_step RECORD;
  v_request_id uuid;
  v_approver_id uuid;
  v_chain RECORD;
  v_levels integer := 0;
  v_category_id uuid;
BEGIN
  -- Only fire on new submissions (status = 'submitted')
  IF NEW.status != 'submitted' THEN
    RETURN NEW;
  END IF;
  
  -- For updates, only fire if status changed to submitted
  IF TG_OP = 'UPDATE' AND OLD.status = 'submitted' THEN
    RETURN NEW;
  END IF;

  -- Step 1: Try to match an expense_approval_rule
  v_workflow_id := NULL;

  -- Try amount-based rules first
  SELECT r.workflow_id INTO v_workflow_id
  FROM expense_approval_rules r
  WHERE r.is_active = true
    AND r.condition_type = 'amount_range'
    AND (r.condition_value->>'min')::numeric <= NEW.amount
    AND (r.condition_value->>'max')::numeric >= NEW.amount
  ORDER BY r.priority ASC
  LIMIT 1;

  -- Try category-based rules if no amount match
  IF v_workflow_id IS NULL THEN
    -- Look up category id from name
    SELECT ec.id INTO v_category_id
    FROM expense_categories ec
    WHERE ec.name = NEW.category AND ec.is_active = true
    LIMIT 1;

    IF v_category_id IS NOT NULL THEN
      SELECT r.workflow_id INTO v_workflow_id
      FROM expense_approval_rules r
      WHERE r.is_active = true
        AND r.condition_type = 'category'
        AND (r.condition_value->>'category_id')::uuid = v_category_id
      ORDER BY r.priority ASC
      LIMIT 1;
    END IF;
  END IF;

  -- Try 'always' rules as final fallback
  IF v_workflow_id IS NULL THEN
    SELECT r.workflow_id INTO v_workflow_id
    FROM expense_approval_rules r
    WHERE r.is_active = true
      AND r.condition_type = 'always'
    ORDER BY r.priority ASC
    LIMIT 1;
  END IF;

  -- Fallback: use default workflow
  IF v_workflow_id IS NULL THEN
    SELECT id INTO v_workflow_id
    FROM approval_workflows
    WHERE entity_type = 'expense' AND is_default = true AND is_active = true
    LIMIT 1;
  END IF;

  -- Ultimate fallback: use old approval_config behavior
  IF v_workflow_id IS NULL THEN
    DECLARE
      v_approval_mode text;
    BEGIN
      SELECT approval_mode INTO v_approval_mode
      FROM approval_config
      WHERE entity_type = 'expense';

      IF v_approval_mode = 'auto' THEN
        NEW.status := 'manager_approved';
        NEW.approved_at := now();
        RETURN NEW;
      END IF;

      PERFORM create_approval_request('expense', NEW.id, NEW.user_id);
      RETURN NEW;
    END;
  END IF;

  -- Load workflow
  SELECT * INTO v_workflow FROM approval_workflows WHERE id = v_workflow_id;

  -- If no steps exist, auto-approve
  IF NOT EXISTS (SELECT 1 FROM workflow_steps WHERE workflow_id = v_workflow_id) THEN
    NEW.status := 'manager_approved';
    NEW.approved_at := now();
    RETURN NEW;
  END IF;

  -- Create approval_request
  INSERT INTO approval_requests (entity_type, entity_id, requester_id, current_level, total_levels, status)
  SELECT 'expense', NEW.id, NEW.user_id, 1, COUNT(*), 'pending'
  FROM workflow_steps WHERE workflow_id = v_workflow_id
  RETURNING id INTO v_request_id;

  -- Create approval_steps from workflow_steps
  FOR v_step IN
    SELECT * FROM workflow_steps
    WHERE workflow_id = v_workflow_id
    ORDER BY step_number ASC
  LOOP
    v_approver_id := NULL;

    IF v_step.approver_type = 'specific_user' AND v_step.specific_user_id IS NOT NULL THEN
      v_approver_id := v_step.specific_user_id;
    ELSIF v_step.approver_type = 'manager' OR v_step.approver_type = 'hierarchy_level' THEN
      -- Get manager at the right level from reporting chain
      SELECT manager_id INTO v_approver_id
      FROM get_reporting_chain(NEW.user_id)
      WHERE level = COALESCE(v_step.hierarchy_level, v_step.step_number)
      LIMIT 1;
    END IF;

    -- Skip step if no approver found
    IF v_approver_id IS NOT NULL THEN
      INSERT INTO approval_steps (approval_request_id, level, approver_id, status)
      VALUES (v_request_id, v_step.step_number, v_approver_id, 'pending');
    END IF;
  END LOOP;

  -- Log submission
  INSERT INTO approval_audit_log (approval_request_id, entity_type, entity_id, action, performed_by, level, metadata)
  VALUES (v_request_id, 'expense', NEW.id, 'submitted', NEW.user_id, 0,
          jsonb_build_object('workflow_id', v_workflow_id, 'workflow_name', v_workflow.workflow_name));

  RETURN NEW;
END;
$function$;

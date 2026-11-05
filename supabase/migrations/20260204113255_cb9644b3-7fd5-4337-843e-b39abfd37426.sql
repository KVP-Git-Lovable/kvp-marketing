-- Phase 1: Enhance leave_types table
ALTER TABLE leave_types
ADD COLUMN IF NOT EXISTS code TEXT,
ADD COLUMN IF NOT EXISTS yearly_limit INTEGER DEFAULT 12,
ADD COLUMN IF NOT EXISTS allow_half_day BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS proof_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3b82f6',
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Add unique constraint on code if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leave_types_code_key') THEN
    ALTER TABLE leave_types ADD CONSTRAINT leave_types_code_key UNIQUE (code);
  END IF;
END $$;

-- Phase 1.2: Enhance leave_policy table
ALTER TABLE leave_policy
ADD COLUMN IF NOT EXISTS max_leaves_per_month INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS backdated_days_allowed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sandwich_rule_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS negative_balance_allowed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_approval_threshold INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_days_advance_notice INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS probation_applicable BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS encashment_allowed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS encashment_limit INTEGER DEFAULT 0;

-- Phase 1.3: Create leave_approval_workflow table
CREATE TABLE IF NOT EXISTS leave_approval_workflow (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_type_id UUID REFERENCES leave_types(id) ON DELETE CASCADE,
  approval_level INTEGER NOT NULL DEFAULT 1,
  approver_type TEXT CHECK (approver_type IN ('manager', 'hr', 'admin', 'specific_user')),
  approver_user_id UUID,
  min_days_trigger INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Phase 1.4: Enhance leave_applications table
ALTER TABLE leave_applications
ADD COLUMN IF NOT EXISTS days_requested NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_half_day BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS half_day_period TEXT CHECK (half_day_period IN ('first_half', 'second_half', NULL)),
ADD COLUMN IF NOT EXISTS is_lop BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS lop_days NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS proof_document_url TEXT,
ADD COLUMN IF NOT EXISTS attendance_marked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sandwich_days_added INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_approval_level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS final_approved_by UUID;

-- Phase 1.5: Create leave_accrual_log table
CREATE TABLE IF NOT EXISTS leave_accrual_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  leave_type_id UUID REFERENCES leave_types(id) ON DELETE CASCADE NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER,
  accrual_type TEXT CHECK (accrual_type IN ('monthly', 'quarterly', 'yearly', 'carry_forward', 'adjustment', 'encashment', 'deduction')),
  days_credited NUMERIC NOT NULL DEFAULT 0,
  days_debited NUMERIC DEFAULT 0,
  balance_after NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Phase 1.6: Create leave_holidays_bridge table
CREATE TABLE IF NOT EXISTS leave_holidays_bridge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_application_id UUID REFERENCES leave_applications(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  is_sandwich_day BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leave_accrual_log_user_year ON leave_accrual_log(user_id, year);
CREATE INDEX IF NOT EXISTS idx_leave_accrual_log_leave_type ON leave_accrual_log(leave_type_id);
CREATE INDEX IF NOT EXISTS idx_leave_holidays_bridge_application ON leave_holidays_bridge(leave_application_id);
CREATE INDEX IF NOT EXISTS idx_leave_approval_workflow_leave_type ON leave_approval_workflow(leave_type_id);

-- Enable RLS on new tables
ALTER TABLE leave_approval_workflow ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_accrual_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_holidays_bridge ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leave_approval_workflow
CREATE POLICY "Admins can manage approval workflows"
ON leave_approval_workflow FOR ALL
TO authenticated
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "Users can view approval workflows"
ON leave_approval_workflow FOR SELECT
TO authenticated
USING (true);

-- RLS Policies for leave_accrual_log
CREATE POLICY "Admins can manage accrual logs"
ON leave_accrual_log FOR ALL
TO authenticated
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "Users can view own accrual logs"
ON leave_accrual_log FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- RLS Policies for leave_holidays_bridge
CREATE POLICY "Admins can manage holiday bridge"
ON leave_holidays_bridge FOR ALL
TO authenticated
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "Users can view holiday bridge for own applications"
ON leave_holidays_bridge FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM leave_applications la 
    WHERE la.id = leave_application_id AND la.user_id = auth.uid()
  )
);

-- Phase 2: Database Functions

-- 2.1 Calculate leave days including sandwich rule
CREATE OR REPLACE FUNCTION calculate_leave_days(
  p_start_date DATE,
  p_end_date DATE,
  p_leave_type_id UUID,
  p_is_half_day BOOLEAN DEFAULT false
)
RETURNS TABLE(total_days NUMERIC, sandwich_days INTEGER) AS $$
DECLARE
  v_sandwich_enabled BOOLEAN;
  v_base_days NUMERIC;
  v_sandwich_count INTEGER := 0;
BEGIN
  -- Get sandwich rule setting
  SELECT COALESCE(sandwich_rule_enabled, false) INTO v_sandwich_enabled
  FROM leave_policy WHERE leave_type_id = p_leave_type_id AND is_active = true;
  
  -- Calculate base days
  v_base_days := (p_end_date - p_start_date + 1);
  
  IF p_is_half_day THEN
    v_base_days := 0.5;
  END IF;
  
  -- If sandwich rule enabled, count weekends/holidays between
  IF v_sandwich_enabled AND NOT p_is_half_day THEN
    SELECT COUNT(*) INTO v_sandwich_count
    FROM generate_series(p_start_date, p_end_date, '1 day'::interval) d
    LEFT JOIN holidays h ON h.holiday_date = d::DATE
    WHERE EXTRACT(DOW FROM d) IN (0, 6) OR h.id IS NOT NULL;
  END IF;
  
  RETURN QUERY SELECT v_base_days, v_sandwich_count;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- 2.2 Validate leave application function
CREATE OR REPLACE FUNCTION validate_leave_application()
RETURNS TRIGGER AS $$
DECLARE
  v_balance NUMERIC;
  v_policy RECORD;
  v_overlapping INTEGER;
  v_days_in_month INTEGER;
  v_calculated RECORD;
BEGIN
  -- Get policy for this leave type
  SELECT * INTO v_policy FROM leave_policy 
  WHERE leave_type_id = NEW.leave_type_id AND is_active = true;
  
  -- Check overlapping leaves
  SELECT COUNT(*) INTO v_overlapping FROM leave_applications
  WHERE user_id = NEW.user_id
    AND id != COALESCE(NEW.id, gen_random_uuid())
    AND status NOT IN ('rejected', 'cancelled')
    AND (NEW.start_date, NEW.end_date) OVERLAPS (start_date, end_date);
  
  IF v_overlapping > 0 THEN
    RAISE EXCEPTION 'Overlapping leave request exists for these dates';
  END IF;
  
  -- Check backdated limit
  IF v_policy.backdated_days_allowed IS NOT NULL AND v_policy.backdated_days_allowed >= 0 THEN
    IF NEW.start_date < CURRENT_DATE - v_policy.backdated_days_allowed THEN
      RAISE EXCEPTION 'Backdated leave request exceeds allowed limit of % days', v_policy.backdated_days_allowed;
    END IF;
  END IF;
  
  -- Check advance notice
  IF v_policy.min_days_advance_notice IS NOT NULL AND v_policy.min_days_advance_notice > 0 THEN
    IF NEW.start_date < CURRENT_DATE + v_policy.min_days_advance_notice THEN
      RAISE EXCEPTION 'Leave request requires % days advance notice', v_policy.min_days_advance_notice;
    END IF;
  END IF;
  
  -- Calculate days
  SELECT * INTO v_calculated FROM calculate_leave_days(NEW.start_date, NEW.end_date, NEW.leave_type_id, COALESCE(NEW.is_half_day, false));
  NEW.days_requested := v_calculated.total_days;
  NEW.sandwich_days_added := v_calculated.sandwich_days;
  
  -- Check max leaves per month
  IF v_policy.max_leaves_per_month IS NOT NULL THEN
    SELECT COALESCE(SUM(days_requested), 0) INTO v_days_in_month
    FROM leave_applications
    WHERE user_id = NEW.user_id
      AND leave_type_id = NEW.leave_type_id
      AND status NOT IN ('rejected', 'cancelled')
      AND EXTRACT(MONTH FROM start_date) = EXTRACT(MONTH FROM NEW.start_date)
      AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM NEW.start_date)
      AND id != COALESCE(NEW.id, gen_random_uuid());
    
    IF (v_days_in_month + NEW.days_requested) > v_policy.max_leaves_per_month THEN
      RAISE EXCEPTION 'Exceeds maximum % leaves allowed per month', v_policy.max_leaves_per_month;
    END IF;
  END IF;
  
  -- Check balance (unless LOP allowed)
  SELECT remaining_balance INTO v_balance FROM leave_balance
  WHERE user_id = NEW.user_id 
    AND leave_type_id = NEW.leave_type_id 
    AND year = EXTRACT(YEAR FROM NEW.start_date);
  
  IF COALESCE(v_balance, 0) < NEW.days_requested AND NOT COALESCE(v_policy.negative_balance_allowed, false) THEN
    RAISE EXCEPTION 'Insufficient leave balance. Available: %, Requested: %', COALESCE(v_balance, 0), NEW.days_requested;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for validation
DROP TRIGGER IF EXISTS validate_leave_before_insert ON leave_applications;
CREATE TRIGGER validate_leave_before_insert
  BEFORE INSERT ON leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION validate_leave_application();

DROP TRIGGER IF EXISTS validate_leave_before_update ON leave_applications;
CREATE TRIGGER validate_leave_before_update
  BEFORE UPDATE ON leave_applications
  FOR EACH ROW
  WHEN (OLD.status = 'pending' AND NEW.status = 'pending')
  EXECUTE FUNCTION validate_leave_application();

-- 2.3 Mark attendance on leave approval
CREATE OR REPLACE FUNCTION mark_attendance_on_leave_approval()
RETURNS TRIGGER AS $$
DECLARE
  leave_date DATE;
  v_leave_type_name TEXT;
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- Get leave type name
    SELECT name INTO v_leave_type_name FROM leave_types WHERE id = NEW.leave_type_id;
    
    -- Mark attendance for each day of leave
    FOR leave_date IN SELECT generate_series(NEW.start_date, NEW.end_date, '1 day')::DATE
    LOOP
      INSERT INTO attendance (user_id, date, status, notes)
      VALUES (NEW.user_id, leave_date, 
              CASE WHEN NEW.is_half_day THEN 'half_day_leave' ELSE 'leave' END,
              'Auto-marked: ' || COALESCE(v_leave_type_name, 'Leave'))
      ON CONFLICT (user_id, date) 
      DO UPDATE SET 
        status = EXCLUDED.status, 
        notes = EXCLUDED.notes,
        updated_at = now();
    END LOOP;
    
    -- Update final approved by
    NEW.final_approved_by := auth.uid();
    NEW.attendance_marked := true;
    
    -- Log the deduction
    INSERT INTO leave_accrual_log (user_id, leave_type_id, year, accrual_type, days_credited, days_debited, balance_after, notes)
    VALUES (
      NEW.user_id, 
      NEW.leave_type_id, 
      EXTRACT(YEAR FROM NEW.start_date)::INTEGER, 
      'deduction', 
      0, 
      NEW.days_requested,
      COALESCE((SELECT remaining_balance FROM leave_balance 
                WHERE user_id = NEW.user_id AND leave_type_id = NEW.leave_type_id 
                AND year = EXTRACT(YEAR FROM NEW.start_date)), 0) - NEW.days_requested,
      'Leave approved: ' || NEW.start_date || ' to ' || NEW.end_date
    );
    
    -- Check if LOP applies (balance goes negative)
    IF (SELECT remaining_balance - NEW.days_requested FROM leave_balance 
        WHERE user_id = NEW.user_id AND leave_type_id = NEW.leave_type_id 
        AND year = EXTRACT(YEAR FROM NEW.start_date)) < 0 THEN
      NEW.is_lop := true;
      NEW.lop_days := ABS(
        (SELECT remaining_balance - NEW.days_requested FROM leave_balance 
         WHERE user_id = NEW.user_id AND leave_type_id = NEW.leave_type_id 
         AND year = EXTRACT(YEAR FROM NEW.start_date))
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for attendance marking
DROP TRIGGER IF EXISTS mark_attendance_after_approval ON leave_applications;
CREATE TRIGGER mark_attendance_after_approval
  BEFORE UPDATE ON leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION mark_attendance_on_leave_approval();

-- 2.4 Monthly accrual function
CREATE OR REPLACE FUNCTION process_monthly_leave_accrual()
RETURNS void AS $$
DECLARE
  v_policy RECORD;
  v_user RECORD;
  v_credit NUMERIC;
  v_current_year INTEGER;
  v_current_month INTEGER;
BEGIN
  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  v_current_month := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;
  
  FOR v_policy IN 
    SELECT lp.*, lt.name as leave_name FROM leave_policy lp
    JOIN leave_types lt ON lt.id = lp.leave_type_id
    WHERE lp.is_active = true AND lp.accrual_type = 'monthly'
  LOOP
    v_credit := ROUND(v_policy.yearly_entitlement / 12.0, 2);
    
    FOR v_user IN 
      SELECT id FROM profiles WHERE user_status = 'active'
    LOOP
      -- Ensure balance record exists
      INSERT INTO leave_balance (user_id, leave_type_id, year, opening_balance, used_balance, remaining_balance)
      VALUES (v_user.id, v_policy.leave_type_id, v_current_year, 0, 0, 0)
      ON CONFLICT (user_id, leave_type_id, year) DO NOTHING;
      
      -- Credit the balance
      UPDATE leave_balance
      SET remaining_balance = COALESCE(remaining_balance, 0) + v_credit,
          updated_at = now()
      WHERE user_id = v_user.id 
        AND leave_type_id = v_policy.leave_type_id
        AND year = v_current_year;
      
      -- Log the accrual
      INSERT INTO leave_accrual_log (user_id, leave_type_id, year, month, accrual_type, days_credited, balance_after, notes)
      VALUES (
        v_user.id, 
        v_policy.leave_type_id, 
        v_current_year, 
        v_current_month, 
        'monthly', 
        v_credit,
        (SELECT remaining_balance FROM leave_balance 
         WHERE user_id = v_user.id AND leave_type_id = v_policy.leave_type_id AND year = v_current_year),
        'Monthly accrual for ' || v_policy.leave_name
      );
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2.5 Year-end carry forward function
CREATE OR REPLACE FUNCTION process_year_end_carry_forward()
RETURNS void AS $$
DECLARE
  v_policy RECORD;
  v_balance RECORD;
  v_carry NUMERIC;
  v_new_year INTEGER;
BEGIN
  v_new_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  
  FOR v_policy IN 
    SELECT lp.*, lt.name as leave_name FROM leave_policy lp
    JOIN leave_types lt ON lt.id = lp.leave_type_id
    WHERE lp.is_active = true
  LOOP
    FOR v_balance IN 
      SELECT * FROM leave_balance 
      WHERE leave_type_id = v_policy.leave_type_id 
        AND year = v_new_year - 1
        AND remaining_balance > 0
    LOOP
      IF v_policy.carry_forward_allowed THEN
        v_carry := LEAST(v_balance.remaining_balance, COALESCE(v_policy.max_carry_forward, v_balance.remaining_balance));
      ELSE
        v_carry := 0;
      END IF;
      
      -- Create or update new year balance with carry forward
      INSERT INTO leave_balance (user_id, leave_type_id, year, opening_balance, used_balance, remaining_balance)
      VALUES (v_balance.user_id, v_policy.leave_type_id, v_new_year, 
              v_policy.yearly_entitlement + v_carry, 0, v_policy.yearly_entitlement + v_carry)
      ON CONFLICT (user_id, leave_type_id, year) 
      DO UPDATE SET 
        opening_balance = leave_balance.opening_balance + v_carry,
        remaining_balance = leave_balance.remaining_balance + v_carry,
        updated_at = now();
      
      -- Log carry forward
      IF v_carry > 0 THEN
        INSERT INTO leave_accrual_log (user_id, leave_type_id, year, accrual_type, days_credited, balance_after, notes)
        VALUES (
          v_balance.user_id, 
          v_policy.leave_type_id, 
          v_new_year, 
          'carry_forward', 
          v_carry,
          (SELECT remaining_balance FROM leave_balance 
           WHERE user_id = v_balance.user_id AND leave_type_id = v_policy.leave_type_id AND year = v_new_year),
          'Carried forward from ' || (v_new_year - 1) || ': ' || v_policy.leave_name
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update timestamp trigger for new tables
CREATE TRIGGER update_leave_approval_workflow_updated_at
  BEFORE UPDATE ON leave_approval_workflow
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
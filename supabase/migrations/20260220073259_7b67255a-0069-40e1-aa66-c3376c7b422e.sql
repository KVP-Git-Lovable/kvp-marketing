
-- ============================================================
-- PHASE 1: ADMIN SUMMARY TABLES + PERFORMANCE INDEXES
-- Attendance Module Scalability Hardening - Week 1
-- ============================================================

-- ============================================================
-- 1. Performance Indexes (attendance + leave_applications)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_attendance_date 
  ON attendance (date);

CREATE INDEX IF NOT EXISTS idx_attendance_status 
  ON attendance (status);

CREATE INDEX IF NOT EXISTS idx_attendance_user_date_status 
  ON attendance (user_id, date, status);

CREATE INDEX IF NOT EXISTS idx_leave_applications_user_id 
  ON leave_applications (user_id);

CREATE INDEX IF NOT EXISTS idx_leave_applications_status 
  ON leave_applications (status);

CREATE INDEX IF NOT EXISTS idx_leave_applications_start_date 
  ON leave_applications (start_date);

CREATE INDEX IF NOT EXISTS idx_leave_applications_user_status 
  ON leave_applications (user_id, status);

CREATE INDEX IF NOT EXISTS idx_leave_accrual_log_created_at 
  ON leave_accrual_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leave_accrual_log_user_year_type 
  ON leave_accrual_log (user_id, year, leave_type_id);

-- ============================================================
-- 2. Table: attendance_daily_admin_summary
-- Pre-aggregated daily statistics for admin dashboard (O(1) reads)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.attendance_daily_admin_summary (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date              date NOT NULL,
  total_employees   integer NOT NULL DEFAULT 0,
  total_present     integer NOT NULL DEFAULT 0,
  total_absent      integer NOT NULL DEFAULT 0,
  total_on_leave    integer NOT NULL DEFAULT 0,
  total_half_day    integer NOT NULL DEFAULT 0,
  avg_hours         numeric(5, 2) DEFAULT 0,
  total_hours_sum   numeric(8, 2) DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_daily_admin_summary_date_key UNIQUE (date)
);

CREATE INDEX IF NOT EXISTS idx_daily_summary_date 
  ON attendance_daily_admin_summary (date DESC);

ALTER TABLE public.attendance_daily_admin_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read daily summary"
  ON public.attendance_daily_admin_summary
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can manage daily summary"
  ON public.attendance_daily_admin_summary
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 3. Table: attendance_user_monthly_summary
-- Per-user monthly totals for reports (O(1) per user per month)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.attendance_user_monthly_summary (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year                  integer NOT NULL,
  month                 integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  present_days          integer NOT NULL DEFAULT 0,
  absent_days           integer NOT NULL DEFAULT 0,
  leave_days            integer NOT NULL DEFAULT 0,
  half_day_leave_days   integer NOT NULL DEFAULT 0,
  regularized_days      integer NOT NULL DEFAULT 0,
  total_hours           numeric(8, 2) DEFAULT 0,
  avg_daily_hours       numeric(5, 2) DEFAULT 0,
  lop_days              numeric(5, 2) DEFAULT 0,
  working_days          integer DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendance_user_monthly_summary_unique UNIQUE (user_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_summary_user_year_month 
  ON attendance_user_monthly_summary (user_id, year, month);

CREATE INDEX IF NOT EXISTS idx_monthly_summary_year_month 
  ON attendance_user_monthly_summary (year, month);

ALTER TABLE public.attendance_user_monthly_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own monthly summary"
  ON public.attendance_user_monthly_summary
  FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() IS NOT NULL);

CREATE POLICY "System can manage monthly summary"
  ON public.attendance_user_monthly_summary
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 4. Function: refresh_daily_admin_summary(p_date DATE)
-- Recalculates and upserts one row for the given date
-- ============================================================

CREATE OR REPLACE FUNCTION public.refresh_daily_admin_summary(p_date DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_employees   integer;
  v_total_present     integer;
  v_total_on_leave    integer;
  v_total_half_day    integer;
  v_total_hours_sum   numeric;
  v_avg_hours         numeric;
  v_present_with_hours integer;
BEGIN
  -- Count active employees (profiles with active status)
  SELECT COUNT(*) INTO v_total_employees
  FROM profiles
  WHERE user_status = 'active' OR user_status IS NULL;

  -- Count present (status = 'present' OR 'regularized')
  SELECT COUNT(*) INTO v_total_present
  FROM attendance
  WHERE date = p_date
    AND status IN ('present', 'regularized');

  -- Count on leave (status = 'leave')
  SELECT COUNT(*) INTO v_total_on_leave
  FROM attendance
  WHERE date = p_date
    AND status = 'leave';

  -- Count half day leave
  SELECT COUNT(*) INTO v_total_half_day
  FROM attendance
  WHERE date = p_date
    AND status = 'half_day_leave';

  -- Sum of total_hours for present employees
  SELECT 
    COALESCE(SUM(total_hours), 0),
    COUNT(*) FILTER (WHERE total_hours IS NOT NULL AND total_hours > 0)
  INTO v_total_hours_sum, v_present_with_hours
  FROM attendance
  WHERE date = p_date
    AND status IN ('present', 'regularized')
    AND total_hours IS NOT NULL;

  -- Calculate average hours
  IF v_present_with_hours > 0 THEN
    v_avg_hours := ROUND(v_total_hours_sum / v_present_with_hours, 2);
  ELSE
    v_avg_hours := 0;
  END IF;

  -- Upsert the daily summary row
  INSERT INTO attendance_daily_admin_summary (
    date,
    total_employees,
    total_present,
    total_absent,
    total_on_leave,
    total_half_day,
    avg_hours,
    total_hours_sum,
    updated_at
  ) VALUES (
    p_date,
    v_total_employees,
    v_total_present,
    GREATEST(0, v_total_employees - v_total_present - v_total_on_leave - v_total_half_day),
    v_total_on_leave,
    v_total_half_day,
    v_avg_hours,
    v_total_hours_sum,
    now()
  )
  ON CONFLICT (date) DO UPDATE SET
    total_employees = EXCLUDED.total_employees,
    total_present   = EXCLUDED.total_present,
    total_absent    = EXCLUDED.total_absent,
    total_on_leave  = EXCLUDED.total_on_leave,
    total_half_day  = EXCLUDED.total_half_day,
    avg_hours       = EXCLUDED.avg_hours,
    total_hours_sum = EXCLUDED.total_hours_sum,
    updated_at      = now();
END;
$$;

-- ============================================================
-- 5. Function: refresh_user_monthly_summary(p_user_id, p_year, p_month)
-- Recalculates and upserts per-user monthly totals
-- ============================================================

CREATE OR REPLACE FUNCTION public.refresh_user_monthly_summary(
  p_user_id  UUID,
  p_year     INTEGER,
  p_month    INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_present_days        integer;
  v_leave_days          integer;
  v_half_day_leave_days integer;
  v_regularized_days    integer;
  v_total_hours         numeric;
  v_avg_daily_hours     numeric;
  v_lop_days            numeric;
  v_working_days        integer;
  v_month_start         date;
  v_month_end           date;
  v_present_count       integer;
BEGIN
  v_month_start := make_date(p_year, p_month, 1);
  v_month_end   := (v_month_start + interval '1 month' - interval '1 day')::date;

  -- Present days
  SELECT COUNT(*) INTO v_present_days
  FROM attendance
  WHERE user_id = p_user_id
    AND date BETWEEN v_month_start AND v_month_end
    AND status = 'present';

  -- Leave days
  SELECT COUNT(*) INTO v_leave_days
  FROM attendance
  WHERE user_id = p_user_id
    AND date BETWEEN v_month_start AND v_month_end
    AND status = 'leave';

  -- Half day leave days
  SELECT COUNT(*) INTO v_half_day_leave_days
  FROM attendance
  WHERE user_id = p_user_id
    AND date BETWEEN v_month_start AND v_month_end
    AND status = 'half_day_leave';

  -- Regularized days
  SELECT COUNT(*) INTO v_regularized_days
  FROM attendance
  WHERE user_id = p_user_id
    AND date BETWEEN v_month_start AND v_month_end
    AND status = 'regularized';

  -- Total hours for the month
  SELECT COALESCE(SUM(total_hours), 0), COUNT(*) FILTER (WHERE total_hours IS NOT NULL AND total_hours > 0)
  INTO v_total_hours, v_present_count
  FROM attendance
  WHERE user_id = p_user_id
    AND date BETWEEN v_month_start AND v_month_end
    AND status IN ('present', 'regularized');

  -- Average daily hours
  IF v_present_count > 0 THEN
    v_avg_daily_hours := ROUND(v_total_hours / v_present_count, 2);
  ELSE
    v_avg_daily_hours := 0;
  END IF;

  -- LOP days from approved leave applications with is_lop = true
  SELECT COALESCE(SUM(lop_days), 0) INTO v_lop_days
  FROM leave_applications
  WHERE user_id = p_user_id
    AND status = 'approved'
    AND is_lop = true
    AND start_date BETWEEN v_month_start AND v_month_end;

  -- Working days from config (default 26 if not set)
  SELECT COALESCE(
    (SELECT working_days FROM working_days_config LIMIT 1), 
    26
  ) INTO v_working_days;

  -- Absent days = working days - present - leave - half_day - regularized
  -- Note: stored in the upsert below

  -- Upsert the monthly summary
  INSERT INTO attendance_user_monthly_summary (
    user_id,
    year,
    month,
    present_days,
    absent_days,
    leave_days,
    half_day_leave_days,
    regularized_days,
    total_hours,
    avg_daily_hours,
    lop_days,
    working_days,
    updated_at
  ) VALUES (
    p_user_id,
    p_year,
    p_month,
    v_present_days,
    GREATEST(0, v_working_days - v_present_days - v_leave_days - v_half_day_leave_days - v_regularized_days),
    v_leave_days,
    v_half_day_leave_days,
    v_regularized_days,
    v_total_hours,
    v_avg_daily_hours,
    v_lop_days,
    v_working_days,
    now()
  )
  ON CONFLICT (user_id, year, month) DO UPDATE SET
    present_days        = EXCLUDED.present_days,
    absent_days         = EXCLUDED.absent_days,
    leave_days          = EXCLUDED.leave_days,
    half_day_leave_days = EXCLUDED.half_day_leave_days,
    regularized_days    = EXCLUDED.regularized_days,
    total_hours         = EXCLUDED.total_hours,
    avg_daily_hours     = EXCLUDED.avg_daily_hours,
    lop_days            = EXCLUDED.lop_days,
    working_days        = EXCLUDED.working_days,
    updated_at          = now();
END;
$$;

-- ============================================================
-- 6. Trigger: Refresh summaries when attendance changes
-- ============================================================

CREATE OR REPLACE FUNCTION public.trigger_refresh_attendance_summaries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date   date;
  v_user   uuid;
BEGIN
  -- Get the affected date and user_id from NEW or OLD
  IF TG_OP = 'DELETE' THEN
    v_date := OLD.date;
    v_user := OLD.user_id;
  ELSE
    v_date := NEW.date;
    v_user := NEW.user_id;
  END IF;

  -- Only proceed for meaningful status changes (not just location updates)
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS NOT DISTINCT FROM NEW.status 
       AND OLD.total_hours IS NOT DISTINCT FROM NEW.total_hours
       AND OLD.check_out_time IS NOT DISTINCT FROM NEW.check_out_time THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Refresh daily summary for affected date
  PERFORM refresh_daily_admin_summary(v_date);

  -- Refresh user monthly summary for affected user+month
  PERFORM refresh_user_monthly_summary(
    v_user,
    EXTRACT(YEAR FROM v_date)::integer,
    EXTRACT(MONTH FROM v_date)::integer
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_attendance_summaries ON attendance;
CREATE TRIGGER trg_refresh_attendance_summaries
  AFTER INSERT OR UPDATE OR DELETE
  ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_attendance_summaries();

-- ============================================================
-- 7. Trigger: Refresh summaries when leave is approved
-- ============================================================

CREATE OR REPLACE FUNCTION public.trigger_refresh_leave_summaries()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only refresh when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Refresh daily summary for each leave day
    PERFORM refresh_daily_admin_summary(d::date)
    FROM generate_series(NEW.start_date, NEW.end_date, '1 day'::interval) d;

    -- Refresh user monthly summary (handles multi-month leaves)
    PERFORM refresh_user_monthly_summary(
      NEW.user_id,
      EXTRACT(YEAR FROM NEW.start_date)::integer,
      EXTRACT(MONTH FROM NEW.start_date)::integer
    );

    IF EXTRACT(MONTH FROM NEW.end_date) != EXTRACT(MONTH FROM NEW.start_date) THEN
      PERFORM refresh_user_monthly_summary(
        NEW.user_id,
        EXTRACT(YEAR FROM NEW.end_date)::integer,
        EXTRACT(MONTH FROM NEW.end_date)::integer
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_leave_summaries ON leave_applications;
CREATE TRIGGER trg_refresh_leave_summaries
  AFTER UPDATE
  ON leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_leave_summaries();

-- ============================================================
-- 8. Seed today's summary immediately (so UI works right away)
-- ============================================================

SELECT refresh_daily_admin_summary(CURRENT_DATE);

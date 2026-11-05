
-- Create regularization_policy table (single-row config)
CREATE TABLE public.regularization_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT true,
  monthly_limit integer DEFAULT NULL,
  daily_limit integer NOT NULL DEFAULT 1,
  allow_checkin_edit boolean NOT NULL DEFAULT true,
  allow_checkout_edit boolean NOT NULL DEFAULT true,
  allow_status_edit boolean NOT NULL DEFAULT false,
  reason_mandatory boolean NOT NULL DEFAULT true,
  max_backdate_days integer NOT NULL DEFAULT 7,
  allow_previous_month boolean NOT NULL DEFAULT false,
  restrict_after_payroll_lock boolean NOT NULL DEFAULT false,
  approval_mode text NOT NULL DEFAULT 'manager',
  update_attendance_on_approval boolean NOT NULL DEFAULT true,
  recalculate_hours boolean NOT NULL DEFAULT true,
  adjust_leave_balance boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default row
INSERT INTO public.regularization_policy (id) VALUES (gen_random_uuid());

-- Enable RLS
ALTER TABLE public.regularization_policy ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "Authenticated users can read regularization policy"
  ON public.regularization_policy FOR SELECT TO authenticated
  USING (true);

-- Admin can update
CREATE POLICY "Admins can update regularization policy"
  ON public.regularization_policy FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin can insert (for upsert)
CREATE POLICY "Admins can insert regularization policy"
  ON public.regularization_policy FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Grant permissions
GRANT ALL ON public.regularization_policy TO authenticated;
GRANT SELECT ON public.regularization_policy TO anon;

-- Auto-approve trigger: when approval_mode='auto', immediately approve new requests
CREATE OR REPLACE FUNCTION public.auto_approve_regularization()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_approval_mode text;
BEGIN
  SELECT approval_mode INTO v_approval_mode
  FROM regularization_policy LIMIT 1;

  IF v_approval_mode = 'auto' THEN
    NEW.status := 'approved';
    NEW.approved_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_approve_regularization
  BEFORE INSERT ON public.regularization_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_approve_regularization();

-- Update apply_regularization_to_attendance to respect policy settings
CREATE OR REPLACE FUNCTION public.apply_regularization_to_attendance()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_existing_id uuid;
  v_check_in timestamptz;
  v_check_out timestamptz;
  v_total_hours numeric;
  v_policy RECORD;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN

    -- Fetch policy settings
    SELECT update_attendance_on_approval, recalculate_hours
    INTO v_policy
    FROM regularization_policy LIMIT 1;

    -- If policy says don't update attendance, just return
    IF v_policy IS NOT NULL AND v_policy.update_attendance_on_approval = false THEN
      RETURN NEW;
    END IF;

    SELECT id INTO v_existing_id
    FROM attendance
    WHERE user_id = NEW.user_id AND date = NEW.attendance_date;

    IF v_existing_id IS NOT NULL THEN
      UPDATE attendance SET
        check_in_time  = COALESCE(NEW.requested_check_in_time::timestamptz, check_in_time),
        check_out_time = COALESCE(NEW.requested_check_out_time::timestamptz, check_out_time),
        status = 'regularized',
        regularized_request_id = NEW.id,
        total_hours = CASE
          WHEN (v_policy IS NULL OR v_policy.recalculate_hours = true)
               AND COALESCE(NEW.requested_check_out_time::timestamptz, check_out_time) IS NOT NULL
               AND COALESCE(NEW.requested_check_in_time::timestamptz, check_in_time) IS NOT NULL
          THEN ROUND(
            EXTRACT(EPOCH FROM (
              COALESCE(NEW.requested_check_out_time::timestamptz, check_out_time)
              - COALESCE(NEW.requested_check_in_time::timestamptz, check_in_time)
            )) / 3600.0, 2
          )
          ELSE total_hours
        END,
        updated_at = now()
      WHERE id = v_existing_id;
    ELSE
      v_check_in  := NEW.requested_check_in_time::timestamptz;
      v_check_out := NEW.requested_check_out_time::timestamptz;

      IF (v_policy IS NULL OR v_policy.recalculate_hours = true)
         AND v_check_in IS NOT NULL AND v_check_out IS NOT NULL THEN
        v_total_hours := ROUND(EXTRACT(EPOCH FROM (v_check_out - v_check_in)) / 3600.0, 2);
      ELSE
        v_total_hours := NULL;
      END IF;

      INSERT INTO attendance (
        user_id, date, check_in_time, check_out_time,
        status, regularized_request_id, total_hours
      ) VALUES (
        NEW.user_id, NEW.attendance_date, v_check_in, v_check_out,
        'regularized', NEW.id, v_total_hours
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

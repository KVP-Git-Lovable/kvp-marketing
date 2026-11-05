-- Singleton constraints: ensure only 1 row ever exists per policy table
CREATE UNIQUE INDEX IF NOT EXISTS one_row_global_leave 
  ON global_leave_policy ((true));
CREATE UNIQUE INDEX IF NOT EXISTS one_row_auto_end_day 
  ON auto_end_day_policy ((true));
CREATE UNIQUE INDEX IF NOT EXISTS one_row_regularization 
  ON regularization_policy ((true));

-- Seed default rows (safe to re-run with ON CONFLICT DO NOTHING)
INSERT INTO global_leave_policy (
  is_enabled, reset_cycle, custom_reset_date,
  allow_negative_balance, max_negative_limit,
  enable_carry_forward, max_carry_forward_limit, carry_forward_expiry_months,
  min_notice_period_days, max_continuous_leave_days,
  allow_backdated_leave, max_backdate_days,
  enable_half_day, enable_sandwich_rule
) VALUES (
  true, 'calendar_year', null,
  false, 0,
  false, 0, null,
  1, null,
  true, 7,
  true, false
) ON CONFLICT DO NOTHING;

INSERT INTO auto_end_day_policy (
  is_enabled, auto_close_time, timezone,
  last_activity_source, pre_warning_enabled, pre_warning_minutes_before,
  close_in_progress_visits, cancel_planned_visits, mark_unproductive
) VALUES (
  false, '22:00:00', 'Asia/Kolkata',
  'all_activity', true, 15,
  true, false, false
) ON CONFLICT DO NOTHING;

INSERT INTO regularization_policy (
  is_enabled, monthly_limit, daily_limit,
  allow_checkin_edit, allow_checkout_edit, allow_status_edit, reason_mandatory,
  max_backdate_days, allow_previous_month, restrict_after_payroll_lock,
  approval_mode, update_attendance_on_approval, recalculate_hours, adjust_leave_balance
) VALUES (
  true, null, 1,
  true, true, true, true,
  7, false, false,
  'manager', true, true, false
) ON CONFLICT DO NOTHING;
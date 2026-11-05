-- One-time fix: sync used_balance with actual non-rejected/non-cancelled leave applications
UPDATE public.leave_balance lb
SET used_balance = COALESCE(sub.total_days, 0),
    updated_at = now()
FROM (
  SELECT 
    la.user_id, 
    la.leave_type_id, 
    EXTRACT(YEAR FROM la.start_date)::INTEGER as year,
    SUM(COALESCE(la.days_requested, la.end_date - la.start_date + 1)) as total_days
  FROM leave_applications la
  WHERE la.status NOT IN ('rejected', 'cancelled')
  GROUP BY la.user_id, la.leave_type_id, EXTRACT(YEAR FROM la.start_date)::INTEGER
) sub
WHERE lb.user_id = sub.user_id
  AND lb.leave_type_id = sub.leave_type_id
  AND lb.year = sub.year;

UPDATE leave_balance lb
SET 
  opening_balance = ROUND(
    EXTRACT(MONTH FROM CURRENT_DATE) * (lp.yearly_entitlement / 12.0)
  ),
  updated_at = now()
FROM leave_policy lp
WHERE lb.leave_type_id = lp.leave_type_id
  AND lp.accrual_type = 'monthly'
  AND lp.is_active = true
  AND lb.year = EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

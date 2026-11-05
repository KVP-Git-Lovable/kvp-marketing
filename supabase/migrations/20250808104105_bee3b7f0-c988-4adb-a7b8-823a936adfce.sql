-- Insert default leave balances for all existing users
INSERT INTO public.leave_balance (user_id, leave_type_id, opening_balance, used_balance, year)
SELECT 
    p.id as user_id,
    lt.id as leave_type_id,
    CASE 
        WHEN lt.name = 'Annual Leave' THEN 25
        WHEN lt.name = 'Sick Leave' THEN 12
        WHEN lt.name = 'Casual Leave' THEN 10
        WHEN lt.name = 'Maternity Leave' THEN 180
        WHEN lt.name = 'Paternity Leave' THEN 15
        ELSE 10
    END as opening_balance,
    0 as used_balance,
    EXTRACT(year FROM CURRENT_DATE) as year
FROM public.profiles p
CROSS JOIN public.leave_types lt
WHERE NOT EXISTS (
    SELECT 1 FROM public.leave_balance lb 
    WHERE lb.user_id = p.id 
    AND lb.leave_type_id = lt.id 
    AND lb.year = EXTRACT(year FROM CURRENT_DATE)
);
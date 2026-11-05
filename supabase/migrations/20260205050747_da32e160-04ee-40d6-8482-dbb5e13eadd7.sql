-- First delete related leave_balance records
DELETE FROM public.leave_balance
WHERE leave_type_id IN (
  'bc2b094a-5eac-4fc5-8e8e-0ef7855e2b01', -- Maternity Leave
  '02b22996-d086-4aa6-8756-d1bc3e6fc6dc', -- Personal Leave
  'a6f3ccdb-0696-4120-af5e-53da2d28af8a'  -- Paternity Leave
);

-- Delete related leave_policy records
DELETE FROM public.leave_policy
WHERE leave_type_id IN (
  'bc2b094a-5eac-4fc5-8e8e-0ef7855e2b01',
  '02b22996-d086-4aa6-8756-d1bc3e6fc6dc',
  'a6f3ccdb-0696-4120-af5e-53da2d28af8a'
);

-- Delete related leave_accrual_log records
DELETE FROM public.leave_accrual_log
WHERE leave_type_id IN (
  'bc2b094a-5eac-4fc5-8e8e-0ef7855e2b01',
  '02b22996-d086-4aa6-8756-d1bc3e6fc6dc',
  'a6f3ccdb-0696-4120-af5e-53da2d28af8a'
);

-- Now delete the leave types
DELETE FROM public.leave_types
WHERE id IN (
  'bc2b094a-5eac-4fc5-8e8e-0ef7855e2b01', -- Maternity Leave
  '02b22996-d086-4aa6-8756-d1bc3e6fc6dc', -- Personal Leave
  'a6f3ccdb-0696-4120-af5e-53da2d28af8a'  -- Paternity Leave
);

-- Step 1: Drop the generated remaining_balance column
ALTER TABLE public.leave_balance DROP COLUMN IF EXISTS remaining_balance;

-- Step 2: Convert integer columns to numeric(10,2)
ALTER TABLE public.leave_balance
  ALTER COLUMN opening_balance TYPE numeric(10,2) USING opening_balance::numeric(10,2),
  ALTER COLUMN used_balance TYPE numeric(10,2) USING used_balance::numeric(10,2);

-- Step 3: Recreate remaining_balance as generated numeric column
ALTER TABLE public.leave_balance
  ADD COLUMN remaining_balance numeric(10,2) GENERATED ALWAYS AS (opening_balance - used_balance) STORED;

-- Step 4: Backfill used_balance from actual leave_applications data
UPDATE public.leave_balance lb
SET used_balance = COALESCE(sub.total_used, 0)
FROM (
  SELECT
    la.user_id,
    la.leave_type_id,
    EXTRACT(YEAR FROM la.start_date)::integer AS year,
    SUM(COALESCE(la.days_requested, (la.end_date - la.start_date + 1)::numeric)) AS total_used
  FROM public.leave_applications la
  WHERE la.status NOT IN ('rejected', 'cancelled')
  GROUP BY la.user_id, la.leave_type_id, EXTRACT(YEAR FROM la.start_date)::integer
) sub
WHERE lb.user_id = sub.user_id
  AND lb.leave_type_id = sub.leave_type_id
  AND lb.year = sub.year;

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule monthly leave accrual on the 1st of every month at midnight UTC
SELECT cron.schedule(
  'monthly-leave-accrual',
  '0 0 1 * *',
  'SELECT process_monthly_leave_accrual()'
);

-- Run immediately for March 2026
SELECT process_monthly_leave_accrual();
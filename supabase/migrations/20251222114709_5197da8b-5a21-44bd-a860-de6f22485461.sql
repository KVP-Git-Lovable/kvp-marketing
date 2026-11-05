-- Allow null values for monthly_salary and daily_da_allowance columns
ALTER TABLE public.employees ALTER COLUMN monthly_salary DROP NOT NULL;
ALTER TABLE public.employees ALTER COLUMN daily_da_allowance DROP NOT NULL;
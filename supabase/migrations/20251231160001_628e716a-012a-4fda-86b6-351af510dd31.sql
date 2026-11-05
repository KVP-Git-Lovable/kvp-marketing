-- Add working_days column to user_business_plan_months table
-- This allows users to override the auto-calculated working days per month
ALTER TABLE public.user_business_plan_months 
ADD COLUMN working_days integer DEFAULT NULL;

COMMENT ON COLUMN public.user_business_plan_months.working_days IS 'Optional override for working days in the month. If null, calculated automatically.';
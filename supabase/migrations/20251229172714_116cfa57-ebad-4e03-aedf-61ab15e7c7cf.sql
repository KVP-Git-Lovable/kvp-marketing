-- Add quantity_target and unit to distributor_business_plans
ALTER TABLE public.distributor_business_plans
ADD COLUMN IF NOT EXISTS quantity_target numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_unit text DEFAULT 'Units';

-- Add quantity_target to distributor_business_plan_retailers (if not exists)
ALTER TABLE public.distributor_business_plan_retailers
ADD COLUMN IF NOT EXISTS quantity_target numeric DEFAULT 0;

-- Add quantity_target to distributor_business_plan_months
ALTER TABLE public.distributor_business_plan_months
ADD COLUMN IF NOT EXISTS quantity_target numeric DEFAULT 0;
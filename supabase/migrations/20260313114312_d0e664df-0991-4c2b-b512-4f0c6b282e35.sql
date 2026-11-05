ALTER TABLE public.user_business_plans 
ADD COLUMN IF NOT EXISTS personal_quantity_target numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS personal_revenue_target numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS personal_visits_target numeric DEFAULT 0;
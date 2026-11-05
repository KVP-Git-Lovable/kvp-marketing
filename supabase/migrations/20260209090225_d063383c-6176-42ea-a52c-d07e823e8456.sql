-- Add target_strategy column to user_business_plans
-- Values: 'roll_down' (default, distribute from manager), 'roll_up' (sum from subordinates), 'independent' (separate targets)
ALTER TABLE public.user_business_plans 
ADD COLUMN IF NOT EXISTS target_strategy text NOT NULL DEFAULT 'roll_down';

-- Add manager's own target for independent mode (separate from what subordinates get)
ALTER TABLE public.user_business_plans 
ADD COLUMN IF NOT EXISTS manager_own_quantity_target numeric DEFAULT 0;

ALTER TABLE public.user_business_plans 
ADD COLUMN IF NOT EXISTS manager_own_revenue_target numeric DEFAULT 0;
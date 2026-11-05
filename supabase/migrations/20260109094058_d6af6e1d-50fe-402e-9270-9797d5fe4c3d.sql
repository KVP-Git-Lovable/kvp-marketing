-- Create table for storing distributor targets in user business plans
CREATE TABLE IF NOT EXISTS public.user_business_plan_distributors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_plan_id UUID NOT NULL REFERENCES public.user_business_plans(id) ON DELETE CASCADE,
  distributor_id UUID NOT NULL REFERENCES public.distributors(id) ON DELETE CASCADE,
  distributor_name TEXT NOT NULL,
  quantity_target INTEGER DEFAULT 0,
  revenue_target INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_business_plan_distributors ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own distributor targets"
ON public.user_business_plan_distributors
FOR SELECT
USING (
  business_plan_id IN (
    SELECT id FROM public.user_business_plans WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own distributor targets"
ON public.user_business_plan_distributors
FOR INSERT
WITH CHECK (
  business_plan_id IN (
    SELECT id FROM public.user_business_plans WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own distributor targets"
ON public.user_business_plan_distributors
FOR UPDATE
USING (
  business_plan_id IN (
    SELECT id FROM public.user_business_plans WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own distributor targets"
ON public.user_business_plan_distributors
FOR DELETE
USING (
  business_plan_id IN (
    SELECT id FROM public.user_business_plans WHERE user_id = auth.uid()
  )
);

-- Create index for performance
CREATE INDEX idx_user_business_plan_distributors_plan_id ON public.user_business_plan_distributors(business_plan_id);
CREATE INDEX idx_user_business_plan_distributors_distributor_id ON public.user_business_plan_distributors(distributor_id);
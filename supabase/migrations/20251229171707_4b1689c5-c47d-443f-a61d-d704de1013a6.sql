-- Create table for monthly targets in distributor business plans
CREATE TABLE public.distributor_business_plan_months (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_plan_id UUID NOT NULL REFERENCES public.distributor_business_plans(id) ON DELETE CASCADE,
  month_number INTEGER NOT NULL CHECK (month_number >= 1 AND month_number <= 12),
  month_name TEXT NOT NULL,
  target_revenue NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(business_plan_id, month_number)
);

-- Enable RLS
ALTER TABLE public.distributor_business_plan_months ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view distributor plan months"
ON public.distributor_business_plan_months
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create distributor plan months"
ON public.distributor_business_plan_months
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update distributor plan months"
ON public.distributor_business_plan_months
FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete distributor plan months"
ON public.distributor_business_plan_months
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Add index for faster lookups
CREATE INDEX idx_distributor_plan_months_plan_id ON public.distributor_business_plan_months(business_plan_id);
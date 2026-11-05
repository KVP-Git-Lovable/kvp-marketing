-- Create user_business_plan_month_products table for monthly product breakdown
CREATE TABLE IF NOT EXISTS public.user_business_plan_month_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_plan_id UUID NOT NULL REFERENCES public.user_business_plans(id) ON DELETE CASCADE,
  month_number INTEGER NOT NULL,
  month_name TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  percentage NUMERIC DEFAULT 0,
  quantity_target NUMERIC DEFAULT 0,
  revenue_target NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_business_plan_month_products ENABLE ROW LEVEL SECURITY;

-- RLS policies - Users can only access their own data
CREATE POLICY "Users can view their own user_business_plan_month_products"
ON public.user_business_plan_month_products
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_business_plans ubp
    WHERE ubp.id = user_business_plan_month_products.business_plan_id
    AND ubp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own user_business_plan_month_products"
ON public.user_business_plan_month_products
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_business_plans ubp
    WHERE ubp.id = user_business_plan_month_products.business_plan_id
    AND ubp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own user_business_plan_month_products"
ON public.user_business_plan_month_products
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_business_plans ubp
    WHERE ubp.id = user_business_plan_month_products.business_plan_id
    AND ubp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own user_business_plan_month_products"
ON public.user_business_plan_month_products
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_business_plans ubp
    WHERE ubp.id = user_business_plan_month_products.business_plan_id
    AND ubp.user_id = auth.uid()
  )
);

-- Create index for faster queries
CREATE INDEX idx_user_business_plan_month_products_plan_id ON public.user_business_plan_month_products(business_plan_id);
CREATE INDEX idx_user_business_plan_month_products_month ON public.user_business_plan_month_products(business_plan_id, month_number);
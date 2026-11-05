-- Create table for monthly product-wise targets
CREATE TABLE public.distributor_business_plan_month_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_plan_id UUID NOT NULL REFERENCES public.distributor_business_plans(id) ON DELETE CASCADE,
  month_number INTEGER NOT NULL,
  month_name TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  percentage NUMERIC NOT NULL DEFAULT 0,
  quantity_target NUMERIC DEFAULT 0,
  revenue_target NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(business_plan_id, month_number, product_id)
);

-- Enable RLS
ALTER TABLE public.distributor_business_plan_month_products ENABLE ROW LEVEL SECURITY;

-- Create policies - admins can manage all
CREATE POLICY "Admins can manage month products"
ON public.distributor_business_plan_month_products
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view if they can view the distributor
CREATE POLICY "Users can view month products"
ON public.distributor_business_plan_month_products
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Users can insert month products
CREATE POLICY "Users can insert month products"
ON public.distributor_business_plan_month_products
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update month products
CREATE POLICY "Users can update month products"
ON public.distributor_business_plan_month_products
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Users can delete month products
CREATE POLICY "Users can delete month products"
ON public.distributor_business_plan_month_products
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_distributor_business_plan_month_products_updated_at
BEFORE UPDATE ON public.distributor_business_plan_month_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
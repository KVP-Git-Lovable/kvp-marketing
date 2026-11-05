-- Create user_business_plans table for individual team member FY plans
CREATE TABLE public.user_business_plans (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    revenue_target NUMERIC DEFAULT 0,
    quantity_target NUMERIC DEFAULT 0,
    quantity_unit TEXT DEFAULT 'units',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, year)
);

-- Create user_business_plan_products table
CREATE TABLE public.user_business_plan_products (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    business_plan_id UUID NOT NULL REFERENCES public.user_business_plans(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    quantity_target NUMERIC DEFAULT 0,
    revenue_target NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_business_plan_retailers table
CREATE TABLE public.user_business_plan_retailers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    business_plan_id UUID NOT NULL REFERENCES public.user_business_plans(id) ON DELETE CASCADE,
    retailer_id UUID NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
    retailer_name TEXT NOT NULL,
    last_year_revenue NUMERIC DEFAULT 0,
    target_revenue NUMERIC DEFAULT 0,
    quantity_target NUMERIC DEFAULT 0,
    growth_percent NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_business_plan_months table
CREATE TABLE public.user_business_plan_months (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    business_plan_id UUID NOT NULL REFERENCES public.user_business_plans(id) ON DELETE CASCADE,
    month_number INTEGER NOT NULL CHECK (month_number >= 1 AND month_number <= 12),
    month_name TEXT NOT NULL,
    revenue_target NUMERIC DEFAULT 0,
    quantity_target NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(business_plan_id, month_number)
);

-- Enable RLS on all tables
ALTER TABLE public.user_business_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_business_plan_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_business_plan_retailers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_business_plan_months ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_business_plans
CREATE POLICY "Users can view their own business plans"
ON public.user_business_plans FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own business plans"
ON public.user_business_plans FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own business plans"
ON public.user_business_plans FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own business plans"
ON public.user_business_plans FOR DELETE
USING (auth.uid() = user_id);

-- RLS Policies for user_business_plan_products
CREATE POLICY "Users can view their own plan products"
ON public.user_business_plan_products FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.user_business_plans bp
    WHERE bp.id = business_plan_id AND bp.user_id = auth.uid()
));

CREATE POLICY "Users can create their own plan products"
ON public.user_business_plan_products FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_business_plans bp
    WHERE bp.id = business_plan_id AND bp.user_id = auth.uid()
));

CREATE POLICY "Users can update their own plan products"
ON public.user_business_plan_products FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM public.user_business_plans bp
    WHERE bp.id = business_plan_id AND bp.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own plan products"
ON public.user_business_plan_products FOR DELETE
USING (EXISTS (
    SELECT 1 FROM public.user_business_plans bp
    WHERE bp.id = business_plan_id AND bp.user_id = auth.uid()
));

-- RLS Policies for user_business_plan_retailers
CREATE POLICY "Users can view their own plan retailers"
ON public.user_business_plan_retailers FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.user_business_plans bp
    WHERE bp.id = business_plan_id AND bp.user_id = auth.uid()
));

CREATE POLICY "Users can create their own plan retailers"
ON public.user_business_plan_retailers FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_business_plans bp
    WHERE bp.id = business_plan_id AND bp.user_id = auth.uid()
));

CREATE POLICY "Users can update their own plan retailers"
ON public.user_business_plan_retailers FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM public.user_business_plans bp
    WHERE bp.id = business_plan_id AND bp.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own plan retailers"
ON public.user_business_plan_retailers FOR DELETE
USING (EXISTS (
    SELECT 1 FROM public.user_business_plans bp
    WHERE bp.id = business_plan_id AND bp.user_id = auth.uid()
));

-- RLS Policies for user_business_plan_months
CREATE POLICY "Users can view their own plan months"
ON public.user_business_plan_months FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.user_business_plans bp
    WHERE bp.id = business_plan_id AND bp.user_id = auth.uid()
));

CREATE POLICY "Users can create their own plan months"
ON public.user_business_plan_months FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_business_plans bp
    WHERE bp.id = business_plan_id AND bp.user_id = auth.uid()
));

CREATE POLICY "Users can update their own plan months"
ON public.user_business_plan_months FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM public.user_business_plans bp
    WHERE bp.id = business_plan_id AND bp.user_id = auth.uid()
));

CREATE POLICY "Users can delete their own plan months"
ON public.user_business_plan_months FOR DELETE
USING (EXISTS (
    SELECT 1 FROM public.user_business_plans bp
    WHERE bp.id = business_plan_id AND bp.user_id = auth.uid()
));

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_user_business_plans_updated_at
    BEFORE UPDATE ON public.user_business_plans
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_business_plan_months_updated_at
    BEFORE UPDATE ON public.user_business_plan_months
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
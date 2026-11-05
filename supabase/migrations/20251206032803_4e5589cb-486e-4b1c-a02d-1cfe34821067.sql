
-- Add missing fields to distributors table
ALTER TABLE public.distributors 
ADD COLUMN IF NOT EXISTS distribution_level text DEFAULT 'distributor',
ADD COLUMN IF NOT EXISTS onboarding_date date,
ADD COLUMN IF NOT EXISTS years_of_relationship integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS strength text,
ADD COLUMN IF NOT EXISTS weakness text,
ADD COLUMN IF NOT EXISTS opportunities text,
ADD COLUMN IF NOT EXISTS threats text,
ADD COLUMN IF NOT EXISTS partnership_status text DEFAULT 'registered',
ADD COLUMN IF NOT EXISTS drop_reason text,
ADD COLUMN IF NOT EXISTS competition_products text[],
ADD COLUMN IF NOT EXISTS network_retailers_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS distribution_experience_years integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS evaluation_checklist jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS region_coverage text;

-- Add missing fields to distributor_contacts table
ALTER TABLE public.distributor_contacts
ADD COLUMN IF NOT EXISTS role text,
ADD COLUMN IF NOT EXISTS years_of_experience integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS years_with_distributor integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS birth_date date;

-- Add distributor_id to retailers table if not exists
ALTER TABLE public.retailers
ADD COLUMN IF NOT EXISTS distributor_id uuid REFERENCES public.distributors(id);

-- Add distributor_id to beats table if not exists
ALTER TABLE public.beats
ADD COLUMN IF NOT EXISTS distributor_id uuid REFERENCES public.distributors(id);

-- Create distributor business plans table
CREATE TABLE IF NOT EXISTS public.distributor_business_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  distributor_id uuid NOT NULL REFERENCES public.distributors(id) ON DELETE CASCADE,
  year integer NOT NULL,
  revenue_target numeric DEFAULT 0,
  coverage_target text,
  territory_target text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(distributor_id, year)
);

-- Create distributor business plan product targets
CREATE TABLE IF NOT EXISTS public.distributor_business_plan_products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_plan_id uuid NOT NULL REFERENCES public.distributor_business_plans(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  product_name text NOT NULL,
  quantity_target integer DEFAULT 0,
  revenue_target numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create distributor business plan retailer targets
CREATE TABLE IF NOT EXISTS public.distributor_business_plan_retailers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_plan_id uuid NOT NULL REFERENCES public.distributor_business_plans(id) ON DELETE CASCADE,
  retailer_id uuid NOT NULL,
  retailer_name text NOT NULL,
  last_year_revenue numeric DEFAULT 0,
  target_revenue numeric DEFAULT 0,
  growth_percent numeric DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.distributor_business_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributor_business_plan_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributor_business_plan_retailers ENABLE ROW LEVEL SECURITY;

-- RLS policies for distributor_business_plans
CREATE POLICY "Authenticated users can view business plans" ON public.distributor_business_plans
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create business plans" ON public.distributor_business_plans
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update business plans" ON public.distributor_business_plans
FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete business plans" ON public.distributor_business_plans
FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for distributor_business_plan_products
CREATE POLICY "Authenticated users can view plan products" ON public.distributor_business_plan_products
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage plan products" ON public.distributor_business_plan_products
FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS policies for distributor_business_plan_retailers
CREATE POLICY "Authenticated users can view plan retailers" ON public.distributor_business_plan_retailers
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage plan retailers" ON public.distributor_business_plan_retailers
FOR ALL USING (auth.uid() IS NOT NULL);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_retailers_distributor_id ON public.retailers(distributor_id);
CREATE INDEX IF NOT EXISTS idx_beats_distributor_id ON public.beats(distributor_id);
CREATE INDEX IF NOT EXISTS idx_distributor_business_plans_distributor ON public.distributor_business_plans(distributor_id);

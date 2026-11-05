-- Add RLS policy to allow authenticated users to view business plans for reporting
-- This enables managers to see their team's target data in analytics

-- For user_business_plans - allow authenticated users to SELECT for reporting
CREATE POLICY "Authenticated users can view business plans for reporting"
ON public.user_business_plans
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');

-- For user_business_plan_months - allow authenticated users to SELECT for reporting  
CREATE POLICY "Authenticated users can view business plan months for reporting"
ON public.user_business_plan_months
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');

-- For user_business_plan_month_products - allow authenticated users to SELECT for reporting
CREATE POLICY "Authenticated users can view business plan month products for reporting"
ON public.user_business_plan_month_products
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');

-- For beat_plans - allow authenticated users to SELECT for reporting
CREATE POLICY "Authenticated users can view beat plans for reporting"
ON public.beat_plans
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');

-- For visits - allow authenticated users to SELECT for reporting
CREATE POLICY "Authenticated users can view visits for reporting"
ON public.visits
FOR SELECT
TO authenticated
USING (auth.role() = 'authenticated');
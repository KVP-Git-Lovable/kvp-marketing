-- Fix security issue: Restrict product data access to authenticated users only
-- Update RLS policies for products table
DROP POLICY IF EXISTS "Products are viewable by authenticated users" ON public.products;
CREATE POLICY "Products are viewable by authenticated users" 
ON public.products 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Update RLS policies for product_variants table  
DROP POLICY IF EXISTS "Product variants are viewable by authenticated users" ON public.product_variants;
CREATE POLICY "Product variants are viewable by authenticated users" 
ON public.product_variants 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Update RLS policies for product_schemes table
DROP POLICY IF EXISTS "Product schemes are viewable by authenticated users" ON public.product_schemes;
CREATE POLICY "Product schemes are viewable by authenticated users" 
ON public.product_schemes 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Update RLS policies for product_categories table
DROP POLICY IF EXISTS "Product categories are viewable by authenticated users" ON public.product_categories;
CREATE POLICY "Product categories are viewable by authenticated users" 
ON public.product_categories 
FOR SELECT 
USING (auth.uid() IS NOT NULL);
-- Create product categories table
CREATE TABLE public.product_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category_id uuid REFERENCES public.product_categories(id),
  rate numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'piece',
  closing_stock integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create product schemes table
CREATE TABLE public.product_schemes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  scheme_type text NOT NULL DEFAULT 'discount', -- discount, buy_x_get_y, percentage_off
  condition_quantity integer, -- minimum quantity needed
  discount_percentage numeric, -- percentage discount
  discount_amount numeric, -- fixed amount discount
  free_quantity integer, -- free items for buy_x_get_y
  is_active boolean DEFAULT true,
  start_date date,
  end_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_schemes ENABLE ROW LEVEL SECURITY;

-- Create policies for product_categories
CREATE POLICY "Product categories are viewable by authenticated users" 
ON public.product_categories 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage product categories" 
ON public.product_categories 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create policies for products
CREATE POLICY "Products are viewable by authenticated users" 
ON public.products 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage products" 
ON public.products 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create policies for product_schemes
CREATE POLICY "Product schemes are viewable by authenticated users" 
ON public.product_schemes 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage product schemes" 
ON public.product_schemes 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create triggers for updated_at
CREATE TRIGGER update_product_categories_updated_at
BEFORE UPDATE ON public.product_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_schemes_updated_at
BEFORE UPDATE ON public.product_schemes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default product categories
INSERT INTO public.product_categories (name, description) VALUES
('Rice & Grains', 'Rice, wheat, and other grain products'),
('Oil & Ghee', 'Cooking oils, ghee, and related products'),
('Pulses', 'Lentils, beans, and pulse products'),
('Spices', 'Spices and seasonings'),
('Beverages', 'Drinks, juices, and beverages');

-- Insert sample products with different SKUs
INSERT INTO public.products (sku, name, description, rate, unit, closing_stock, category_id) 
SELECT 
  'RICE001', 'Basmati Rice Premium', 'Premium quality basmati rice', 85.00, 'kg', 150,
  (SELECT id FROM public.product_categories WHERE name = 'Rice & Grains' LIMIT 1)
UNION ALL SELECT 
  'OIL001', 'Sunflower Oil', 'Pure sunflower cooking oil', 120.00, 'liter', 80,
  (SELECT id FROM public.product_categories WHERE name = 'Oil & Ghee' LIMIT 1)
UNION ALL SELECT 
  'PULSE001', 'Toor Dal', 'Premium toor dal', 95.00, 'kg', 200,
  (SELECT id FROM public.product_categories WHERE name = 'Pulses' LIMIT 1)
UNION ALL SELECT 
  'SPICE001', 'Turmeric Powder', 'Pure turmeric powder', 45.00, 'packet', 120,
  (SELECT id FROM public.product_categories WHERE name = 'Spices' LIMIT 1)
UNION ALL SELECT 
  'BEV001', 'Fruit Juice', 'Fresh fruit juice', 35.00, 'bottle', 90,
  (SELECT id FROM public.product_categories WHERE name = 'Beverages' LIMIT 1);

-- Insert sample schemes
INSERT INTO public.product_schemes (product_id, name, description, scheme_type, condition_quantity, discount_percentage, is_active)
SELECT 
  p.id, 'Buy 10 Get 10% Off', 'Buy 10 or more packets and get 10% discount', 'discount', 10, 10.00, true
FROM public.products p WHERE p.sku = 'SPICE001'
UNION ALL SELECT 
  p.id, 'Bulk Purchase Discount', 'Buy 5 or more bags and get 5% off', 'discount', 5, 5.00, true
FROM public.products p WHERE p.sku = 'RICE001';
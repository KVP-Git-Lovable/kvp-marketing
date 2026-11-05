
-- Create a default category
INSERT INTO public.product_categories (name, description) VALUES ('Tea', 'Tea products');

-- Insert 5 sample products
INSERT INTO public.products (name, sku, category_id, rate, unit, closing_stock, is_active)
SELECT name, sku, (SELECT id FROM public.product_categories WHERE name = 'Tea' LIMIT 1), rate, unit, 100, true
FROM (VALUES
  ('KADAK PYALI ADARAK 250G', 'KPA-250G', 185, 'grams'),
  ('KADAK PYALI BLUE 40G', 'KPB-40G', 45, 'grams'),
  ('KADAK PYALI YELLOW 100G', 'KPY-100G', 95, 'grams'),
  ('KADAK GOLD 250G', 'KG-250G', 210, 'grams'),
  ('VAYU 30G', 'VAYU-30G', 35, 'grams')
) AS t(name, sku, rate, unit);

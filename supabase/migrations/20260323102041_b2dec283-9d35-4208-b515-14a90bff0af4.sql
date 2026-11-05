-- Seed default feature flags (safe to re-run)
INSERT INTO public.feature_flags (feature_key, feature_name, is_enabled)
VALUES 
  ('order_based_delivery', 'Order Based Delivery', false),
  ('d1_delivery', 'D-1 Delivery', false),
  ('packing_list_module', 'Packing List Module', false),
  ('delivery_agent_app', 'Delivery Agent App', false),
  ('location_check_in_enabled', 'Location Check-in', true),
  ('van_sales', 'Van Sales', false)
ON CONFLICT (feature_key) DO NOTHING;

-- Seed default performance module config
INSERT INTO public.performance_module_config (active_module)
VALUES ('none')
ON CONFLICT DO NOTHING;
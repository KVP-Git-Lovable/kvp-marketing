
-- Create target_parameter_definitions table
CREATE TABLE public.target_parameter_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parameter_key text NOT NULL UNIQUE,
  icon text NOT NULL DEFAULT '📊',
  data_source_table text,
  data_source_id_column text DEFAULT 'id',
  data_source_name_column text DEFAULT 'name',
  data_source_filter jsonb,
  is_system boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.target_parameter_definitions ENABLE ROW LEVEL SECURITY;

-- RLS: everyone authenticated can read
CREATE POLICY "Authenticated users can read parameter definitions"
  ON public.target_parameter_definitions FOR SELECT
  TO authenticated USING (true);

-- RLS: only admins can insert/update/delete (using has_role if available, else allow authenticated for now)
CREATE POLICY "Authenticated users can manage parameter definitions"
  ON public.target_parameter_definitions FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Seed system parameters
INSERT INTO public.target_parameter_definitions (name, parameter_key, icon, data_source_table, data_source_id_column, data_source_name_column, is_system, display_order) VALUES
  ('Product-wise', 'product', '📦', 'products', 'id', 'name', true, 1),
  ('Retailer-wise', 'retailer', '🏪', 'retailers', 'id', 'retailer_name', true, 2),
  ('Beat-wise', 'beat', '📍', 'beats', 'id', 'beat_name', true, 3),
  ('Distributor-wise', 'distributor', '🚛', 'distributors', 'id', 'name', true, 4),
  ('Territory-wise', 'territory', '🗺️', 'territories', 'id', 'name', true, 5),
  ('Month-wise', 'monthly', '📅', NULL, NULL, NULL, true, 6);

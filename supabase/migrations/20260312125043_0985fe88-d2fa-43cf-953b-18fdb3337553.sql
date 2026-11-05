
-- Create target_metric_definitions table
CREATE TABLE public.target_metric_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  unit text DEFAULT '',
  icon text DEFAULT 'target',
  color text DEFAULT 'blue',
  is_system boolean DEFAULT false,
  display_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.target_metric_definitions ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read metric definitions
CREATE POLICY "Authenticated users can read metric definitions"
  ON public.target_metric_definitions FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert/update/delete custom metrics
CREATE POLICY "Authenticated users can manage metric definitions"
  ON public.target_metric_definitions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed the 4 system defaults
INSERT INTO public.target_metric_definitions (name, unit, icon, color, is_system, display_order) VALUES
  ('Quantity', 'Kg', 'package', 'blue', true, 1),
  ('Revenue', '₹', 'indian-rupee', 'emerald', true, 2),
  ('Productive Visits', '', 'footprints', 'violet', true, 3),
  ('Retailer Activation', '', 'store', 'amber', true, 4);

-- Create plan_enabled_metrics junction table
CREATE TABLE public.plan_enabled_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fy_config_id uuid REFERENCES public.fy_target_config(id) ON DELETE CASCADE NOT NULL,
  metric_id uuid REFERENCES public.target_metric_definitions(id) ON DELETE CASCADE NOT NULL,
  total_target numeric DEFAULT 0,
  unit_override text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(fy_config_id, metric_id)
);

-- Enable RLS
ALTER TABLE public.plan_enabled_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read plan metrics"
  ON public.plan_enabled_metrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage plan metrics"
  ON public.plan_enabled_metrics FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

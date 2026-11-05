-- Create scheme_applicability table for multi-level targeting
CREATE TABLE public.scheme_applicability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES public.product_schemes(id) ON DELETE CASCADE,
  applicability_level TEXT NOT NULL CHECK (applicability_level IN ('global', 'territory', 'beat', 'retailer', 'salesperson', 'product')),
  entity_id UUID,
  entity_name TEXT,
  include_children BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient lookups
CREATE INDEX idx_scheme_applicability_scheme ON public.scheme_applicability(scheme_id);
CREATE INDEX idx_scheme_applicability_level ON public.scheme_applicability(applicability_level, entity_id);

-- Enable RLS
ALTER TABLE public.scheme_applicability ENABLE ROW LEVEL SECURITY;

-- RLS policies for scheme_applicability
CREATE POLICY "Anyone can view scheme applicability"
  ON public.scheme_applicability FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage scheme applicability"
  ON public.scheme_applicability FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Create scheme_policy_config table for global policy settings
CREATE TABLE public.scheme_policy_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_name TEXT NOT NULL UNIQUE,
  policy_value JSONB NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID
);

-- Enable RLS
ALTER TABLE public.scheme_policy_config ENABLE ROW LEVEL SECURITY;

-- RLS policies for scheme_policy_config
CREATE POLICY "Anyone can view scheme policies"
  ON public.scheme_policy_config FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage scheme policies"
  ON public.scheme_policy_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Insert default policies
INSERT INTO public.scheme_policy_config (policy_name, policy_value, description) VALUES
('max_schemes_per_order', '{"value": 5}', 'Maximum number of schemes that can be applied to a single order'),
('allow_scheme_stacking', '{"value": true, "same_type_stacking": false}', 'Whether multiple schemes can be applied together'),
('priority_resolution', '{"method": "highest_discount"}', 'How to resolve conflicts: highest_discount, most_specific, priority, first_applied'),
('mutual_exclusion_groups', '{"groups": []}', 'Groups of schemes that cannot be applied together'),
('auto_apply_best_scheme', '{"value": true}', 'Automatically apply the best available scheme');

-- Add new columns to product_schemes
ALTER TABLE public.product_schemes 
ADD COLUMN IF NOT EXISTS applicability_type TEXT DEFAULT 'global',
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS exclusion_group TEXT,
ADD COLUMN IF NOT EXISTS max_usage_count INTEGER,
ADD COLUMN IF NOT EXISTS current_usage_count INTEGER DEFAULT 0;

-- Add check constraint separately to avoid issues with existing data
ALTER TABLE public.product_schemes 
ADD CONSTRAINT product_schemes_applicability_type_check 
CHECK (applicability_type IN ('global', 'targeted', 'hybrid'));
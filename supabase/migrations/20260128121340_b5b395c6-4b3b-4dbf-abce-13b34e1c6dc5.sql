-- Create FY Target Configuration table
CREATE TABLE IF NOT EXISTS fy_target_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fy_year INTEGER NOT NULL UNIQUE,
  enable_quantity BOOLEAN DEFAULT true,
  enable_revenue BOOLEAN DEFAULT true,
  enable_visits BOOLEAN DEFAULT false,
  quantity_unit TEXT DEFAULT 'Kg',
  enabled_parameters JSONB DEFAULT '{"product":true,"retailer":true,"beat":true,"distributor":true,"territory":true,"monthly":true}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE fy_target_config ENABLE ROW LEVEL SECURITY;

-- Create policies - only admin/system admin can manage
CREATE POLICY "Admins can view target config"
  ON fy_target_config FOR SELECT
  USING (public.is_system_admin(auth.uid()));

CREATE POLICY "Admins can create target config"
  ON fy_target_config FOR INSERT
  WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "Admins can update target config"
  ON fy_target_config FOR UPDATE
  USING (public.is_system_admin(auth.uid()));

CREATE POLICY "Admins can delete target config"
  ON fy_target_config FOR DELETE
  USING (public.is_system_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_fy_target_config_updated_at
  BEFORE UPDATE ON fy_target_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
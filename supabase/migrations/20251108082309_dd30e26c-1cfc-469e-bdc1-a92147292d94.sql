-- Create feature_flags table for managing application features
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_key TEXT NOT NULL UNIQUE,
  feature_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Admins can manage all feature flags
CREATE POLICY "Admins can manage feature flags"
  ON public.feature_flags
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can view feature flags
CREATE POLICY "Users can view feature flags"
  ON public.feature_flags
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Create trigger for updated_at
CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create audit log for feature flag changes
CREATE TABLE IF NOT EXISTS public.feature_flag_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_flag_id UUID NOT NULL REFERENCES public.feature_flags(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  old_value BOOLEAN NOT NULL,
  new_value BOOLEAN NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit table
ALTER TABLE public.feature_flag_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view feature flag audit"
  ON public.feature_flag_audit
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert audit logs
CREATE POLICY "System can insert feature flag audit"
  ON public.feature_flag_audit
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Function to log feature flag changes
CREATE OR REPLACE FUNCTION log_feature_flag_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_enabled IS DISTINCT FROM NEW.is_enabled THEN
    INSERT INTO public.feature_flag_audit (feature_flag_id, changed_by, old_value, new_value)
    VALUES (NEW.id, auth.uid(), OLD.is_enabled, NEW.is_enabled);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to log changes
CREATE TRIGGER feature_flag_change_trigger
  AFTER UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION log_feature_flag_change();

-- Insert default feature flags
INSERT INTO public.feature_flags (feature_key, feature_name, description, category, is_enabled) VALUES
  ('retailer_management', 'Retailer Management', 'Create, edit, and manage retailer information', 'Sales', true),
  ('beat_creation', 'Beat Creation', 'Create and manage sales beats', 'Sales', true),
  ('order_module', 'Order Module', 'Place and track orders', 'Sales', true),
  ('visit_planner', 'Visit Planner', 'Plan and schedule retailer visits', 'Sales', true),
  ('analytics_reports', 'Analytics & Reports', 'View sales analytics and performance reports', 'Reports', true),
  ('attendance_tracking', 'Attendance Tracking', 'Check-in/out and attendance management', 'Operations', true),
  ('expense_management', 'Expense Management', 'Submit and track expenses', 'Finance', true),
  ('inventory_management', 'Inventory Management', 'Manage stock and inventory', 'Inventory', true),
  ('distributor_management', 'Distributor Management', 'Manage distributors and super stockists', 'Sales', true),
  ('scheme_management', 'Scheme Management', 'Create and manage product schemes', 'Sales', true),
  ('van_sales', 'Van Sales', 'Van sales operations and management', 'Sales', true),
  ('gps_tracking', 'GPS Tracking', 'Real-time GPS tracking of field staff', 'Operations', true),
  ('leave_management', 'Leave Management', 'Apply for and manage leaves', 'HR', true),
  ('performance_tracking', 'Performance Tracking', 'View performance metrics and goals', 'Reports', true),
  ('branding_requests', 'Branding Requests', 'Submit branding and marketing requests', 'Marketing', true),
  ('support_tickets', 'Support Tickets', 'Raise and track support requests', 'Support', true),
  ('user_management', 'User Management', 'Admin user and role management', 'Admin', true),
  ('territory_management', 'Territory Management', 'Manage sales territories', 'Admin', true),
  ('product_management', 'Product Management', 'Manage product catalog', 'Admin', true),
  ('ai_recommendations', 'AI Recommendations', 'AI-powered sales recommendations', 'AI', true)
ON CONFLICT (feature_key) DO NOTHING;
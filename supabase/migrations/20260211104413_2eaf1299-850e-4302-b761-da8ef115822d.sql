
-- 1. Tax Masters table
CREATE TABLE public.tax_masters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  tax_type TEXT NOT NULL DEFAULT 'GST' CHECK (tax_type IN ('GST', 'IGST', 'Custom')),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  apply_to_primary_orders BOOLEAN NOT NULL DEFAULT true,
  apply_to_secondary_orders BOOLEAN NOT NULL DEFAULT true,
  cloned_from_id UUID REFERENCES public.tax_masters(id),
  version INTEGER NOT NULL DEFAULT 1,
  effective_from DATE,
  effective_to DATE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Tax Components table (CGST, SGST, IGST, CESS per tax master)
CREATE TABLE public.tax_components (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tax_master_id UUID NOT NULL REFERENCES public.tax_masters(id) ON DELETE CASCADE,
  component_type TEXT NOT NULL CHECK (component_type IN ('CGST', 'SGST', 'IGST', 'CESS')),
  percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tax_master_id, component_type)
);

-- 3. Tax Product Map (SKU-level mapping)
CREATE TABLE public.tax_product_map (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tax_master_id UUID NOT NULL REFERENCES public.tax_masters(id) ON DELETE CASCADE,
  product_variant_id UUID NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  is_applicable BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tax_master_id, product_variant_id)
);

-- Enable RLS
ALTER TABLE public.tax_masters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_product_map ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Admin-only write, authenticated read
CREATE POLICY "Authenticated users can read tax masters"
  ON public.tax_masters FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage tax masters"
  ON public.tax_masters FOR ALL
  TO authenticated USING (public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "Authenticated users can read tax components"
  ON public.tax_components FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage tax components"
  ON public.tax_components FOR ALL
  TO authenticated USING (public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()));

CREATE POLICY "Authenticated users can read tax product map"
  ON public.tax_product_map FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage tax product map"
  ON public.tax_product_map FOR ALL
  TO authenticated USING (public.is_system_admin(auth.uid()))
  WITH CHECK (public.is_system_admin(auth.uid()));

-- Updated_at triggers
CREATE TRIGGER update_tax_masters_updated_at
  BEFORE UPDATE ON public.tax_masters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tax_components_updated_at
  BEFORE UPDATE ON public.tax_components
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tax_product_map_updated_at
  BEFORE UPDATE ON public.tax_product_map
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 1. GRN table for tracking goods receipts with returns
CREATE TABLE IF NOT EXISTS public.goods_receipt_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_number text NOT NULL UNIQUE,
  order_id uuid NOT NULL REFERENCES public.primary_orders(id),
  distributor_id uuid NOT NULL REFERENCES public.distributors(id),
  receipt_type text NOT NULL DEFAULT 'full',
  status text NOT NULL DEFAULT 'draft',
  received_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.grn_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id uuid NOT NULL REFERENCES public.goods_receipt_notes(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.primary_order_items(id),
  product_id uuid NOT NULL,
  variant_id uuid,
  product_name text NOT NULL,
  variant_name text,
  ordered_quantity numeric NOT NULL DEFAULT 0,
  received_quantity numeric NOT NULL DEFAULT 0,
  returned_quantity numeric NOT NULL DEFAULT 0,
  return_reason text,
  damaged_quantity numeric NOT NULL DEFAULT 0,
  batch_number text,
  expiry_date date,
  unit text NOT NULL DEFAULT 'pcs',
  unit_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 2. Primary invoices table
CREATE TABLE IF NOT EXISTS public.primary_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  order_id uuid NOT NULL REFERENCES public.primary_orders(id),
  distributor_id uuid NOT NULL REFERENCES public.distributors(id),
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  finalized_at timestamptz,
  finalized_by text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Primary shipments table
CREATE TABLE IF NOT EXISTS public.primary_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_number text NOT NULL UNIQUE,
  order_id uuid NOT NULL REFERENCES public.primary_orders(id),
  distributor_id uuid NOT NULL REFERENCES public.distributors(id),
  invoice_id uuid REFERENCES public.primary_invoices(id),
  transporter_name text,
  vehicle_number text,
  driver_name text,
  driver_phone text,
  lr_number text,
  dispatch_date date,
  expected_delivery_date date,
  actual_delivery_date date,
  dispatch_warehouse text,
  status text NOT NULL DEFAULT 'pending',
  tracking_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Standalone return notes
CREATE TABLE IF NOT EXISTS public.primary_return_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number text NOT NULL UNIQUE,
  order_id uuid REFERENCES public.primary_orders(id),
  grn_id uuid REFERENCES public.goods_receipt_notes(id),
  distributor_id uuid NOT NULL REFERENCES public.distributors(id),
  return_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft',
  total_return_value numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.primary_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_note_id uuid NOT NULL REFERENCES public.primary_return_notes(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  variant_id uuid,
  product_name text NOT NULL,
  variant_name text,
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'pcs',
  unit_price numeric NOT NULL DEFAULT 0,
  return_reason text NOT NULL,
  batch_number text,
  condition text DEFAULT 'damaged',
  created_at timestamptz DEFAULT now()
);

-- 5. Inventory valuation config table  
CREATE TABLE IF NOT EXISTS public.inventory_valuation_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  valuation_method text NOT NULL DEFAULT 'none',
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);

INSERT INTO public.inventory_valuation_config (valuation_method)
SELECT 'none' WHERE NOT EXISTS (SELECT 1 FROM public.inventory_valuation_config);

-- 6. Primary order scheme tracking
CREATE TABLE IF NOT EXISTS public.primary_order_schemes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.primary_orders(id) ON DELETE CASCADE,
  scheme_id uuid NOT NULL REFERENCES public.product_schemes(id),
  scheme_name text NOT NULL,
  scheme_type text NOT NULL,
  discount_amount numeric DEFAULT 0,
  free_quantity numeric DEFAULT 0,
  free_product_name text,
  applied_at timestamptz DEFAULT now()
);

-- RLS policies
ALTER TABLE public.goods_receipt_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grn_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.primary_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.primary_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.primary_return_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.primary_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_valuation_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.primary_order_schemes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage goods_receipt_notes" ON public.goods_receipt_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage grn_items" ON public.grn_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage primary_invoices" ON public.primary_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage primary_shipments" ON public.primary_shipments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage primary_return_notes" ON public.primary_return_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage primary_return_items" ON public.primary_return_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage inventory_valuation_config" ON public.inventory_valuation_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage primary_order_schemes" ON public.primary_order_schemes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- GRN number generator
CREATE OR REPLACE FUNCTION public.generate_grn_number()
RETURNS text AS $$
DECLARE
  seq_val integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(grn_number FROM 'GRN-\d{4}-(\d+)') AS integer)), 0) + 1
  INTO seq_val FROM public.goods_receipt_notes;
  RETURN 'GRN-' || TO_CHAR(NOW(), 'YYMM') || '-' || LPAD(seq_val::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Return number generator
CREATE OR REPLACE FUNCTION public.generate_return_number()
RETURNS text AS $$
DECLARE
  seq_val integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(return_number FROM 'RET-\d{4}-(\d+)') AS integer)), 0) + 1
  INTO seq_val FROM public.primary_return_notes;
  RETURN 'RET-' || TO_CHAR(NOW(), 'YYMM') || '-' || LPAD(seq_val::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Invoice number generator
CREATE OR REPLACE FUNCTION public.generate_primary_invoice_number()
RETURNS text AS $$
DECLARE
  seq_val integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 'PINV-\d{4}-(\d+)') AS integer)), 0) + 1
  INTO seq_val FROM public.primary_invoices;
  RETURN 'PINV-' || TO_CHAR(NOW(), 'YYMM') || '-' || LPAD(seq_val::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Shipment number generator
CREATE OR REPLACE FUNCTION public.generate_shipment_number()
RETURNS text AS $$
DECLARE
  seq_val integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(shipment_number FROM 'SHP-\d{4}-(\d+)') AS integer)), 0) + 1
  INTO seq_val FROM public.primary_shipments;
  RETURN 'SHP-' || TO_CHAR(NOW(), 'YYMM') || '-' || LPAD(seq_val::text, 5, '0');
END;
$$ LANGUAGE plpgsql;
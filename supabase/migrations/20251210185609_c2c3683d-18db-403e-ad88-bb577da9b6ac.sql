-- =============================================
-- DISTRIBUTOR PORTAL - PHASE 1 MIGRATION
-- =============================================

-- 1. Distributor Users Table (Portal Authentication)
CREATE TABLE public.distributor_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  distributor_id UUID NOT NULL REFERENCES public.distributors(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'manager', 'warehouse', 'accounts', 'staff')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_distributor_users_distributor_id ON public.distributor_users(distributor_id);
CREATE INDEX idx_distributor_users_email ON public.distributor_users(email);

-- Enable RLS
ALTER TABLE public.distributor_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for distributor_users
CREATE POLICY "Distributor users can view their own profile"
  ON public.distributor_users FOR SELECT
  USING (auth.uid()::text = id::text OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage distributor users"
  ON public.distributor_users FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Primary Orders Table (Company to Distributor orders)
CREATE TABLE public.primary_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  distributor_id UUID NOT NULL REFERENCES public.distributors(id) ON DELETE CASCADE,
  created_by_user_id UUID, -- Can be distributor user or admin
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'confirmed', 'processing', 'dispatched', 'in_transit', 'delivered', 'partially_delivered', 'cancelled')),
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  payment_terms TEXT DEFAULT 'net_30',
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'overdue')),
  shipping_address TEXT,
  notes TEXT,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  dispatched_at TIMESTAMP WITH TIME ZONE,
  dispatch_reference TEXT,
  transporter_name TEXT,
  vehicle_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_primary_orders_distributor_id ON public.primary_orders(distributor_id);
CREATE INDEX idx_primary_orders_status ON public.primary_orders(status);
CREATE INDEX idx_primary_orders_order_date ON public.primary_orders(order_date);

-- Enable RLS
ALTER TABLE public.primary_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for primary_orders
CREATE POLICY "Distributors can view their own orders"
  ON public.primary_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.distributor_users du 
      WHERE du.id::text = auth.uid()::text 
      AND du.distributor_id = primary_orders.distributor_id
    ) OR has_role(auth.uid(), 'admin'::app_role)
    OR auth.uid() IS NOT NULL -- Allow regular users to view for now
  );

CREATE POLICY "Distributors can create orders"
  ON public.primary_orders FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.distributor_users du 
      WHERE du.id::text = auth.uid()::text 
      AND du.distributor_id = primary_orders.distributor_id
    ) OR has_role(auth.uid(), 'admin'::app_role)
    OR auth.uid() IS NOT NULL
  );

CREATE POLICY "Distributors can update their orders"
  ON public.primary_orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.distributor_users du 
      WHERE du.id::text = auth.uid()::text 
      AND du.distributor_id = primary_orders.distributor_id
    ) OR has_role(auth.uid(), 'admin'::app_role)
    OR auth.uid() IS NOT NULL
  );

CREATE POLICY "Admins can delete orders"
  ON public.primary_orders FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Primary Order Items Table
CREATE TABLE public.primary_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.primary_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  product_name TEXT NOT NULL,
  variant_name TEXT,
  sku TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  received_quantity INTEGER DEFAULT 0,
  damaged_quantity INTEGER DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'pieces',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC DEFAULT 0,
  tax_percent NUMERIC DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  batch_number TEXT,
  expiry_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_primary_order_items_order_id ON public.primary_order_items(order_id);
CREATE INDEX idx_primary_order_items_product_id ON public.primary_order_items(product_id);

-- Enable RLS
ALTER TABLE public.primary_order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for primary_order_items
CREATE POLICY "Users can view order items"
  ON public.primary_order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.primary_orders po 
      WHERE po.id = primary_order_items.order_id
    )
  );

CREATE POLICY "Users can insert order items"
  ON public.primary_order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.primary_orders po 
      WHERE po.id = primary_order_items.order_id
    )
  );

CREATE POLICY "Users can update order items"
  ON public.primary_order_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.primary_orders po 
      WHERE po.id = primary_order_items.order_id
    )
  );

CREATE POLICY "Admins can delete order items"
  ON public.primary_order_items FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Distributor Inventory Table
CREATE TABLE public.distributor_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  distributor_id UUID NOT NULL REFERENCES public.distributors(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  product_name TEXT NOT NULL,
  variant_name TEXT,
  sku TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  available_quantity INTEGER GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
  reorder_level INTEGER DEFAULT 10,
  max_stock_level INTEGER DEFAULT 1000,
  unit TEXT NOT NULL DEFAULT 'pieces',
  unit_cost NUMERIC DEFAULT 0,
  total_value NUMERIC GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  batch_number TEXT,
  manufacturing_date DATE,
  expiry_date DATE,
  last_received_date DATE,
  last_issued_date DATE,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(distributor_id, product_id, variant_id, batch_number)
);

-- Create indexes
CREATE INDEX idx_distributor_inventory_distributor_id ON public.distributor_inventory(distributor_id);
CREATE INDEX idx_distributor_inventory_product_id ON public.distributor_inventory(product_id);
CREATE INDEX idx_distributor_inventory_expiry ON public.distributor_inventory(expiry_date);

-- Enable RLS
ALTER TABLE public.distributor_inventory ENABLE ROW LEVEL SECURITY;

-- RLS Policies for distributor_inventory
CREATE POLICY "Distributors can view their inventory"
  ON public.distributor_inventory FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.distributor_users du 
      WHERE du.id::text = auth.uid()::text 
      AND du.distributor_id = distributor_inventory.distributor_id
    ) OR has_role(auth.uid(), 'admin'::app_role)
    OR auth.uid() IS NOT NULL
  );

CREATE POLICY "Distributors can manage their inventory"
  ON public.distributor_inventory FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.distributor_users du 
      WHERE du.id::text = auth.uid()::text 
      AND du.distributor_id = distributor_inventory.distributor_id
    ) OR has_role(auth.uid(), 'admin'::app_role)
    OR auth.uid() IS NOT NULL
  );

-- 5. Function to generate primary order number
CREATE OR REPLACE FUNCTION generate_primary_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'PO-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                        LPAD(NEXTVAL('primary_order_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for order numbers
CREATE SEQUENCE IF NOT EXISTS primary_order_seq START 1;

-- Create trigger for auto-generating order number
CREATE TRIGGER set_primary_order_number
  BEFORE INSERT ON public.primary_orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_primary_order_number();

-- 6. Function to update timestamps
CREATE TRIGGER update_distributor_users_updated_at
  BEFORE UPDATE ON public.distributor_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_primary_orders_updated_at
  BEFORE UPDATE ON public.primary_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_distributor_inventory_updated_at
  BEFORE UPDATE ON public.distributor_inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
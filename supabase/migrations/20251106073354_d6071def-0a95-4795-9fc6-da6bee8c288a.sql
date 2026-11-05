-- Van Inward GRN (Morning Stock/Inventory)
CREATE TABLE IF NOT EXISTS public.van_inward_grn (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  van_id UUID NOT NULL REFERENCES public.vans(id) ON DELETE CASCADE,
  beat_id UUID REFERENCES public.beats(id),
  user_id UUID NOT NULL,
  grn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  grn_number TEXT NOT NULL UNIQUE,
  van_distance_km NUMERIC(10,2) DEFAULT 0,
  documents_verified BOOLEAN DEFAULT false,
  verified_by UUID,
  verified_by_name TEXT,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Van Inward GRN Items
CREATE TABLE IF NOT EXISTS public.van_inward_grn_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grn_id UUID NOT NULL REFERENCES public.van_inward_grn(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  quantity INTEGER NOT NULL DEFAULT 0,
  ai_scanned BOOLEAN DEFAULT false,
  ai_confidence_percent NUMERIC(5,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Van Return GRN (Returns from retailers)
CREATE TABLE IF NOT EXISTS public.van_return_grn (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  van_id UUID NOT NULL REFERENCES public.vans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  retailer_id UUID NOT NULL REFERENCES public.retailers(id),
  visit_id UUID REFERENCES public.visits(id),
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  return_grn_number TEXT NOT NULL UNIQUE,
  is_verified BOOLEAN DEFAULT false,
  verified_by UUID,
  verified_by_name TEXT,
  verified_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Van Return GRN Items
CREATE TABLE IF NOT EXISTS public.van_return_grn_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_grn_id UUID NOT NULL REFERENCES public.van_return_grn(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  return_quantity INTEGER NOT NULL DEFAULT 0,
  return_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Van Live Inventory (Real-time tracking)
CREATE TABLE IF NOT EXISTS public.van_live_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  van_id UUID NOT NULL REFERENCES public.vans(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  morning_stock INTEGER NOT NULL DEFAULT 0,
  sold_quantity INTEGER NOT NULL DEFAULT 0,
  returned_quantity INTEGER NOT NULL DEFAULT 0,
  current_stock INTEGER NOT NULL DEFAULT 0,
  pending_quantity INTEGER NOT NULL DEFAULT 0,
  last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(van_id, product_id, variant_id, date)
);

-- Van Order Fulfillment Tracking
CREATE TABLE IF NOT EXISTS public.van_order_fulfillment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  van_id UUID NOT NULL REFERENCES public.vans(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  requested_quantity INTEGER NOT NULL,
  fulfilled_quantity INTEGER NOT NULL DEFAULT 0,
  pending_quantity INTEGER NOT NULL DEFAULT 0,
  fulfillment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Van Closing Stock (computed daily)
CREATE TABLE IF NOT EXISTS public.van_closing_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  van_id UUID NOT NULL REFERENCES public.vans(id) ON DELETE CASCADE,
  closing_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_inward_qty INTEGER NOT NULL DEFAULT 0,
  total_sold_qty INTEGER NOT NULL DEFAULT 0,
  total_returned_qty INTEGER NOT NULL DEFAULT 0,
  closing_inventory_qty INTEGER NOT NULL DEFAULT 0,
  computed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(van_id, closing_date)
);

-- Van Closing Stock Items
CREATE TABLE IF NOT EXISTS public.van_closing_stock_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  closing_stock_id UUID NOT NULL REFERENCES public.van_closing_stock(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  morning_qty INTEGER NOT NULL DEFAULT 0,
  sold_qty INTEGER NOT NULL DEFAULT 0,
  returned_qty INTEGER NOT NULL DEFAULT 0,
  closing_qty INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_van_inward_grn_van_date ON public.van_inward_grn(van_id, grn_date);
CREATE INDEX IF NOT EXISTS idx_van_inward_grn_items_grn ON public.van_inward_grn_items(grn_id);
CREATE INDEX IF NOT EXISTS idx_van_return_grn_van_date ON public.van_return_grn(van_id, return_date);
CREATE INDEX IF NOT EXISTS idx_van_return_grn_items_return ON public.van_return_grn_items(return_grn_id);
CREATE INDEX IF NOT EXISTS idx_van_live_inventory_van_date ON public.van_live_inventory(van_id, date);
CREATE INDEX IF NOT EXISTS idx_van_order_fulfillment_order ON public.van_order_fulfillment(order_id);
CREATE INDEX IF NOT EXISTS idx_van_closing_stock_van_date ON public.van_closing_stock(van_id, closing_date);

-- Enable RLS
ALTER TABLE public.van_inward_grn ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.van_inward_grn_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.van_return_grn ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.van_return_grn_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.van_live_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.van_order_fulfillment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.van_closing_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.van_closing_stock_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their van inward GRN"
  ON public.van_inward_grn
  FOR ALL
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view van inward GRN items"
  ON public.van_inward_grn_items
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.van_inward_grn
    WHERE van_inward_grn.id = van_inward_grn_items.grn_id
    AND (van_inward_grn.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  ));

CREATE POLICY "Users can manage van inward GRN items"
  ON public.van_inward_grn_items
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.van_inward_grn
    WHERE van_inward_grn.id = van_inward_grn_items.grn_id
    AND (van_inward_grn.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  ));

CREATE POLICY "Users can manage their van return GRN"
  ON public.van_return_grn
  FOR ALL
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view van return GRN items"
  ON public.van_return_grn_items
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.van_return_grn
    WHERE van_return_grn.id = van_return_grn_items.return_grn_id
    AND (van_return_grn.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  ));

CREATE POLICY "Users can manage van return GRN items"
  ON public.van_return_grn_items
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.van_return_grn
    WHERE van_return_grn.id = van_return_grn_items.return_grn_id
    AND (van_return_grn.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  ));

CREATE POLICY "Users can view van live inventory"
  ON public.van_live_inventory
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can manage van live inventory"
  ON public.van_live_inventory
  FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view van order fulfillment"
  ON public.van_order_fulfillment
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = van_order_fulfillment.order_id
    AND (orders.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  ));

CREATE POLICY "System can manage van order fulfillment"
  ON public.van_order_fulfillment
  FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view van closing stock"
  ON public.van_closing_stock
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can manage van closing stock"
  ON public.van_closing_stock
  FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view van closing stock items"
  ON public.van_closing_stock_items
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can manage van closing stock items"
  ON public.van_closing_stock_items
  FOR ALL
  USING (auth.uid() IS NOT NULL);
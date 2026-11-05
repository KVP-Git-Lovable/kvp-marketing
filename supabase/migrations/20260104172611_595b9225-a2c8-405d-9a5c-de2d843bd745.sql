-- =====================================================
-- DISTRIBUTOR INVENTORY MANAGEMENT MODULE
-- =====================================================

-- 1. Transaction ledger for all stock movements
CREATE TABLE public.distributor_inventory_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  distributor_id UUID NOT NULL REFERENCES public.distributors(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('inward', 'sale', 'return_from_retailer', 'return_to_company', 'adjustment')),
  quantity INTEGER NOT NULL,
  running_balance INTEGER,
  reference_type TEXT CHECK (reference_type IN ('primary_order', 'secondary_order', 'retailer_return', 'company_return', 'adjustment')),
  reference_id UUID,
  reference_number TEXT,
  batch_number TEXT,
  expiry_date DATE,
  unit TEXT,
  unit_cost NUMERIC(12,2),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Returns FROM retailers
CREATE TABLE public.distributor_returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  distributor_id UUID NOT NULL REFERENCES public.distributors(id) ON DELETE CASCADE,
  retailer_id UUID NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  return_number TEXT NOT NULL UNIQUE,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  order_number TEXT,
  total_quantity INTEGER DEFAULT 0,
  total_value NUMERIC(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'added_to_stock', 'rejected')),
  notes TEXT,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Items in retailer returns
CREATE TABLE public.distributor_return_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  return_id UUID NOT NULL REFERENCES public.distributor_returns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit TEXT,
  unit_price NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  reason TEXT NOT NULL CHECK (reason IN ('damaged', 'expired', 'wrong_product', 'quality_issue', 'excess_stock', 'other')),
  condition TEXT NOT NULL DEFAULT 'good' CHECK (condition IN ('good', 'damaged', 'expired')),
  batch_number TEXT,
  notes TEXT,
  added_to_stock BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Returns TO company
CREATE TABLE public.distributor_company_returns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  distributor_id UUID NOT NULL REFERENCES public.distributors(id) ON DELETE CASCADE,
  return_number TEXT NOT NULL UNIQUE,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_quantity INTEGER DEFAULT 0,
  total_value NUMERIC(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'picked_up', 'credited', 'rejected')),
  notes TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  picked_up_at TIMESTAMP WITH TIME ZONE,
  credit_note_number TEXT,
  credit_note_amount NUMERIC(12,2),
  credit_note_date DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Items in company returns
CREATE TABLE public.distributor_company_return_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_return_id UUID NOT NULL REFERENCES public.distributor_company_returns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit TEXT,
  unit_cost NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  reason TEXT NOT NULL CHECK (reason IN ('damaged', 'expired', 'slow_moving', 'recall', 'quality_issue', 'other')),
  source TEXT DEFAULT 'own_stock' CHECK (source IN ('retailer_return', 'own_stock')),
  source_return_id UUID REFERENCES public.distributor_returns(id) ON DELETE SET NULL,
  batch_number TEXT,
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sequences for return numbers
CREATE SEQUENCE IF NOT EXISTS distributor_return_seq START 1;
CREATE SEQUENCE IF NOT EXISTS distributor_company_return_seq START 1;

-- Function to generate return numbers
CREATE OR REPLACE FUNCTION generate_distributor_return_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.return_number IS NULL OR NEW.return_number = '' THEN
    NEW.return_number := 'RET-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                         LPAD(NEXTVAL('distributor_return_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_company_return_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.return_number IS NULL OR NEW.return_number = '' THEN
    NEW.return_number := 'CRET-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                         LPAD(NEXTVAL('distributor_company_return_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for auto-generating return numbers
CREATE TRIGGER set_distributor_return_number
  BEFORE INSERT ON public.distributor_returns
  FOR EACH ROW EXECUTE FUNCTION generate_distributor_return_number();

CREATE TRIGGER set_company_return_number
  BEFORE INSERT ON public.distributor_company_returns
  FOR EACH ROW EXECUTE FUNCTION generate_company_return_number();

-- Triggers for updated_at
CREATE TRIGGER update_distributor_returns_updated_at
  BEFORE UPDATE ON public.distributor_returns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_distributor_company_returns_updated_at
  BEFORE UPDATE ON public.distributor_company_returns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_inventory_transactions_distributor ON public.distributor_inventory_transactions(distributor_id);
CREATE INDEX idx_inventory_transactions_product ON public.distributor_inventory_transactions(product_id);
CREATE INDEX idx_inventory_transactions_type ON public.distributor_inventory_transactions(transaction_type);
CREATE INDEX idx_inventory_transactions_date ON public.distributor_inventory_transactions(created_at);
CREATE INDEX idx_distributor_returns_distributor ON public.distributor_returns(distributor_id);
CREATE INDEX idx_distributor_returns_retailer ON public.distributor_returns(retailer_id);
CREATE INDEX idx_distributor_returns_status ON public.distributor_returns(status);
CREATE INDEX idx_company_returns_distributor ON public.distributor_company_returns(distributor_id);
CREATE INDEX idx_company_returns_status ON public.distributor_company_returns(status);

-- Enable RLS
ALTER TABLE public.distributor_inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributor_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributor_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributor_company_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributor_company_return_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for distributor_inventory_transactions
CREATE POLICY "Users can view inventory transactions"
  ON public.distributor_inventory_transactions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert inventory transactions"
  ON public.distributor_inventory_transactions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for distributor_returns
CREATE POLICY "Users can view distributor returns"
  ON public.distributor_returns FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert distributor returns"
  ON public.distributor_returns FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update distributor returns"
  ON public.distributor_returns FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for distributor_return_items
CREATE POLICY "Users can view return items"
  ON public.distributor_return_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert return items"
  ON public.distributor_return_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update return items"
  ON public.distributor_return_items FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete return items"
  ON public.distributor_return_items FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for distributor_company_returns
CREATE POLICY "Users can view company returns"
  ON public.distributor_company_returns FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert company returns"
  ON public.distributor_company_returns FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update company returns"
  ON public.distributor_company_returns FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for distributor_company_return_items
CREATE POLICY "Users can view company return items"
  ON public.distributor_company_return_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert company return items"
  ON public.distributor_company_return_items FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update company return items"
  ON public.distributor_company_return_items FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete company return items"
  ON public.distributor_company_return_items FOR DELETE
  USING (auth.uid() IS NOT NULL);
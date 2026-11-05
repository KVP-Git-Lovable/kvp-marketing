
-- Institutional Sales CRM Tables

-- 1. Leads Table
CREATE TABLE public.inst_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  lead_source TEXT DEFAULT 'direct',
  lead_status TEXT DEFAULT 'new',
  annual_potential_value NUMERIC DEFAULT 0,
  industry_type TEXT,
  notes TEXT,
  assigned_to UUID,
  created_by UUID NOT NULL,
  converted_account_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Accounts Table
CREATE TABLE public.inst_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_name TEXT NOT NULL,
  account_type TEXT DEFAULT 'institutional',
  industry TEXT,
  annual_revenue NUMERIC DEFAULT 0,
  employee_count INTEGER,
  billing_address TEXT,
  shipping_address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  gst_number TEXT,
  pan_number TEXT,
  website TEXT,
  phone TEXT,
  email TEXT,
  account_owner UUID,
  parent_account_id UUID REFERENCES public.inst_accounts(id),
  credit_limit NUMERIC DEFAULT 0,
  payment_terms INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Contacts Table
CREATE TABLE public.inst_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.inst_accounts(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  designation TEXT,
  department TEXT,
  is_primary_contact BOOLEAN DEFAULT false,
  is_decision_maker BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Opportunities Table
CREATE TABLE public.inst_opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.inst_accounts(id) ON DELETE CASCADE,
  opportunity_name TEXT NOT NULL,
  stage TEXT DEFAULT 'prospecting',
  amount NUMERIC DEFAULT 0,
  probability INTEGER DEFAULT 10,
  expected_close_date DATE,
  lead_source TEXT,
  owner_id UUID,
  contact_id UUID REFERENCES public.inst_contacts(id),
  description TEXT,
  next_step TEXT,
  competitors TEXT,
  closed_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5. Products Table (Institutional)
CREATE TABLE public.inst_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_code TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit TEXT DEFAULT 'Piece',
  base_price NUMERIC NOT NULL DEFAULT 0,
  min_order_quantity INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  hsn_code TEXT,
  gst_rate NUMERIC DEFAULT 18,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Price Books Table
CREATE TABLE public.inst_price_books (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  price_book_name TEXT NOT NULL,
  account_id UUID REFERENCES public.inst_accounts(id),
  is_standard BOOLEAN DEFAULT false,
  effective_from DATE,
  effective_to DATE,
  currency TEXT DEFAULT 'INR',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. Price Book Entries Table
CREATE TABLE public.inst_price_book_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  price_book_id UUID NOT NULL REFERENCES public.inst_price_books(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.inst_products(id) ON DELETE CASCADE,
  list_price NUMERIC NOT NULL DEFAULT 0,
  discount_percentage NUMERIC DEFAULT 0,
  final_price NUMERIC NOT NULL DEFAULT 0,
  min_quantity INTEGER DEFAULT 1,
  max_quantity INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8. Quotes Table
CREATE TABLE public.inst_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_number TEXT NOT NULL UNIQUE,
  opportunity_id UUID REFERENCES public.inst_opportunities(id),
  account_id UUID NOT NULL REFERENCES public.inst_accounts(id),
  contact_id UUID REFERENCES public.inst_contacts(id),
  price_book_id UUID REFERENCES public.inst_price_books(id),
  quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  status TEXT DEFAULT 'draft',
  subtotal NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  terms_and_conditions TEXT,
  notes TEXT,
  created_by UUID NOT NULL,
  approved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9. Quote Line Items Table
CREATE TABLE public.inst_quote_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.inst_quotes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.inst_products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount_percentage NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  tax_rate NUMERIC DEFAULT 18,
  tax_amount NUMERIC DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 10. Order Commitments Table
CREATE TABLE public.inst_order_commitments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  commitment_number TEXT NOT NULL UNIQUE,
  opportunity_id UUID REFERENCES public.inst_opportunities(id),
  quote_id UUID REFERENCES public.inst_quotes(id),
  account_id UUID NOT NULL REFERENCES public.inst_accounts(id),
  commitment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_start_date DATE,
  delivery_end_date DATE,
  status TEXT DEFAULT 'draft',
  total_planned_value NUMERIC DEFAULT 0,
  total_actual_value NUMERIC DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 11. Order Commitment Lines Table
CREATE TABLE public.inst_order_commitment_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_commitment_id UUID NOT NULL REFERENCES public.inst_order_commitments(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.inst_products(id),
  planned_quantity INTEGER NOT NULL DEFAULT 0,
  actual_quantity INTEGER DEFAULT 0,
  delivered_quantity INTEGER DEFAULT 0,
  planned_delivery_date DATE,
  actual_delivery_date DATE,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  planned_value NUMERIC DEFAULT 0,
  actual_value NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 12. Invoices Table (Institutional)
CREATE TABLE public.inst_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  order_commitment_id UUID REFERENCES public.inst_order_commitments(id),
  account_id UUID NOT NULL REFERENCES public.inst_accounts(id),
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  balance_amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'draft',
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 13. Invoice Lines Table
CREATE TABLE public.inst_invoice_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.inst_invoices(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.inst_products(id),
  commitment_line_id UUID REFERENCES public.inst_order_commitment_lines(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 14. Collections Table
CREATE TABLE public.inst_collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_number TEXT NOT NULL UNIQUE,
  invoice_id UUID NOT NULL REFERENCES public.inst_invoices(id),
  account_id UUID NOT NULL REFERENCES public.inst_accounts(id),
  collection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  reference_number TEXT,
  cheque_number TEXT,
  bank_name TEXT,
  status TEXT DEFAULT 'cleared',
  notes TEXT,
  collected_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 15. License Configuration Table (for feature flags)
CREATE TABLE public.license_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  license_type TEXT NOT NULL DEFAULT 'full_suite',
  field_sales_enabled BOOLEAN DEFAULT true,
  institutional_sales_enabled BOOLEAN DEFAULT true,
  max_users INTEGER DEFAULT 100,
  valid_until DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.inst_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inst_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inst_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inst_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inst_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inst_price_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inst_price_book_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inst_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inst_quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inst_order_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inst_order_commitment_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inst_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inst_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inst_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for inst_leads
CREATE POLICY "Users can view leads" ON public.inst_leads FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create leads" ON public.inst_leads FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update their leads" ON public.inst_leads FOR UPDATE USING (auth.uid() = created_by OR auth.uid() = assigned_to OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete leads" ON public.inst_leads FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for inst_accounts
CREATE POLICY "Users can view accounts" ON public.inst_accounts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create accounts" ON public.inst_accounts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update accounts" ON public.inst_accounts FOR UPDATE USING (auth.uid() = account_owner OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete accounts" ON public.inst_accounts FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for inst_contacts
CREATE POLICY "Users can view contacts" ON public.inst_contacts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can manage contacts" ON public.inst_contacts FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for inst_opportunities
CREATE POLICY "Users can view opportunities" ON public.inst_opportunities FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create opportunities" ON public.inst_opportunities FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update opportunities" ON public.inst_opportunities FOR UPDATE USING (auth.uid() = owner_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete opportunities" ON public.inst_opportunities FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for inst_products
CREATE POLICY "Users can view products" ON public.inst_products FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage products" ON public.inst_products FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for inst_price_books
CREATE POLICY "Users can view price books" ON public.inst_price_books FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage price books" ON public.inst_price_books FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for inst_price_book_entries
CREATE POLICY "Users can view price book entries" ON public.inst_price_book_entries FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage price book entries" ON public.inst_price_book_entries FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for inst_quotes
CREATE POLICY "Users can view quotes" ON public.inst_quotes FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create quotes" ON public.inst_quotes FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update quotes" ON public.inst_quotes FOR UPDATE USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete quotes" ON public.inst_quotes FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for inst_quote_line_items
CREATE POLICY "Users can view quote line items" ON public.inst_quote_line_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can manage quote line items" ON public.inst_quote_line_items FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for inst_order_commitments
CREATE POLICY "Users can view order commitments" ON public.inst_order_commitments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create order commitments" ON public.inst_order_commitments FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update order commitments" ON public.inst_order_commitments FOR UPDATE USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete order commitments" ON public.inst_order_commitments FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for inst_order_commitment_lines
CREATE POLICY "Users can view commitment lines" ON public.inst_order_commitment_lines FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can manage commitment lines" ON public.inst_order_commitment_lines FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for inst_invoices
CREATE POLICY "Users can view invoices" ON public.inst_invoices FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create invoices" ON public.inst_invoices FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update invoices" ON public.inst_invoices FOR UPDATE USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete invoices" ON public.inst_invoices FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for inst_invoice_lines
CREATE POLICY "Users can view invoice lines" ON public.inst_invoice_lines FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can manage invoice lines" ON public.inst_invoice_lines FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for inst_collections
CREATE POLICY "Users can view collections" ON public.inst_collections FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can create collections" ON public.inst_collections FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update collections" ON public.inst_collections FOR UPDATE USING (auth.uid() = collected_by OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete collections" ON public.inst_collections FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for license_config
CREATE POLICY "Users can view license config" ON public.license_config FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can manage license config" ON public.license_config FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default license config
INSERT INTO public.license_config (license_type, field_sales_enabled, institutional_sales_enabled) 
VALUES ('full_suite', true, true);

-- Add institutional_sales feature flag
INSERT INTO public.feature_flags (feature_key, feature_name, description, is_enabled, category)
VALUES ('institutional_sales', 'Institutional Sales CRM', 'Enable Institutional Sales module with Leads, Accounts, Opportunities, Quotes, Orders, and Collections', true, 'modules')
ON CONFLICT (feature_key) DO NOTHING;

-- Create indexes for performance
CREATE INDEX idx_inst_leads_status ON public.inst_leads(lead_status);
CREATE INDEX idx_inst_leads_assigned ON public.inst_leads(assigned_to);
CREATE INDEX idx_inst_accounts_owner ON public.inst_accounts(account_owner);
CREATE INDEX idx_inst_opportunities_stage ON public.inst_opportunities(stage);
CREATE INDEX idx_inst_opportunities_account ON public.inst_opportunities(account_id);
CREATE INDEX idx_inst_quotes_account ON public.inst_quotes(account_id);
CREATE INDEX idx_inst_quotes_status ON public.inst_quotes(status);
CREATE INDEX idx_inst_invoices_account ON public.inst_invoices(account_id);
CREATE INDEX idx_inst_invoices_status ON public.inst_invoices(status);
CREATE INDEX idx_inst_collections_invoice ON public.inst_collections(invoice_id);

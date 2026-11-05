-- Create Van Sales Settings table
CREATE TABLE IF NOT EXISTS public.van_sales_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Insert default setting
INSERT INTO public.van_sales_settings (is_enabled) VALUES (false);

-- Create Vans table
CREATE TABLE IF NOT EXISTS public.vans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  registration_number text NOT NULL UNIQUE,
  make_model text NOT NULL,
  purchase_date date,
  rc_book_url text,
  rc_expiry_date date,
  insurance_url text,
  insurance_expiry_date date,
  pollution_cert_url text,
  pollution_expiry_date date,
  driver_name text,
  driver_phone text,
  driver_address text,
  driver_id_proof_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create Van Beat Assignments table
CREATE TABLE IF NOT EXISTS public.van_beat_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  van_id uuid NOT NULL REFERENCES public.vans(id) ON DELETE CASCADE,
  beat_id uuid NOT NULL REFERENCES public.beats(id) ON DELETE CASCADE,
  assigned_date date NOT NULL DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(van_id, beat_id, assigned_date)
);

-- Create Van Stock table (daily stock movements)
CREATE TABLE IF NOT EXISTS public.van_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  van_id uuid NOT NULL REFERENCES public.vans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  beat_id uuid REFERENCES public.beats(id),
  stock_date date NOT NULL DEFAULT CURRENT_DATE,
  start_of_day_stock jsonb NOT NULL DEFAULT '[]'::jsonb,
  end_of_day_stock jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_ordered_qty jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(van_id, stock_date, user_id)
);

-- Create Van Stock Items table (detailed product tracking)
CREATE TABLE IF NOT EXISTS public.van_stock_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  van_stock_id uuid NOT NULL REFERENCES public.van_stock(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  product_name text NOT NULL,
  start_qty integer NOT NULL DEFAULT 0,
  ordered_qty integer NOT NULL DEFAULT 0,
  left_qty integer NOT NULL DEFAULT 0,
  unit text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create Van Stock Adjustments table (GRN, returns)
CREATE TABLE IF NOT EXISTS public.van_stock_adjustments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  van_stock_id uuid NOT NULL REFERENCES public.van_stock(id) ON DELETE CASCADE,
  adjustment_type text NOT NULL,
  product_id text NOT NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL,
  reason text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.van_sales_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.van_beat_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.van_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.van_stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.van_stock_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for van_sales_settings
CREATE POLICY "Admins can manage van sales settings" ON public.van_sales_settings
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view van sales settings" ON public.van_sales_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- RLS Policies for vans
CREATE POLICY "Admins can manage vans" ON public.vans
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view active vans" ON public.vans
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);

-- RLS Policies for van_beat_assignments
CREATE POLICY "Admins can manage van beat assignments" ON public.van_beat_assignments
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view van beat assignments" ON public.van_beat_assignments
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- RLS Policies for van_stock
CREATE POLICY "Users can create their own van stock" ON public.van_stock
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own van stock" ON public.van_stock
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own van stock" ON public.van_stock
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all van stock" ON public.van_stock
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for van_stock_items
CREATE POLICY "Users can manage van stock items for their van stock" ON public.van_stock_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.van_stock vs
      WHERE vs.id = van_stock_items.van_stock_id
      AND vs.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all van stock items" ON public.van_stock_items
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for van_stock_adjustments
CREATE POLICY "Users can create adjustments for their van stock" ON public.van_stock_adjustments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.van_stock vs
      WHERE vs.id = van_stock_adjustments.van_stock_id
      AND vs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own adjustments" ON public.van_stock_adjustments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.van_stock vs
      WHERE vs.id = van_stock_adjustments.van_stock_id
      AND vs.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all adjustments" ON public.van_stock_adjustments
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Create triggers for updated_at
CREATE TRIGGER update_van_sales_settings_updated_at
  BEFORE UPDATE ON public.van_sales_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vans_updated_at
  BEFORE UPDATE ON public.vans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_van_beat_assignments_updated_at
  BEFORE UPDATE ON public.van_beat_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_van_stock_updated_at
  BEFORE UPDATE ON public.van_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_van_stock_items_updated_at
  BEFORE UPDATE ON public.van_stock_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
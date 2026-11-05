-- Enhanced price books table with type, territory, distributor category support
CREATE TABLE IF NOT EXISTS public.price_books (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_book_type TEXT NOT NULL DEFAULT 'standard' CHECK (price_book_type IN ('standard', 'territory', 'distributor_category', 'retailer_territory')),
  currency TEXT DEFAULT 'INR',
  is_standard BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  effective_from DATE,
  effective_to DATE,
  territory_id UUID REFERENCES public.territories(id) ON DELETE SET NULL,
  distributor_category TEXT,
  cloned_from UUID REFERENCES public.price_books(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Price book entries (products with prices)
CREATE TABLE IF NOT EXISTS public.price_book_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  price_book_id UUID NOT NULL REFERENCES public.price_books(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  list_price NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC DEFAULT 0,
  final_price NUMERIC NOT NULL DEFAULT 0,
  min_quantity INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(price_book_id, product_id, variant_id)
);

-- Distributor price book assignments (link distributors to price books)
CREATE TABLE IF NOT EXISTS public.distributor_price_books (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  distributor_id UUID NOT NULL REFERENCES public.distributors(id) ON DELETE CASCADE,
  price_book_id UUID NOT NULL REFERENCES public.price_books(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deactivated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.price_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_book_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributor_price_books ENABLE ROW LEVEL SECURITY;

-- RLS Policies for price_books
CREATE POLICY "Authenticated users can view price books" 
ON public.price_books FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Admin can manage price books" 
ON public.price_books FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- RLS Policies for price_book_entries
CREATE POLICY "Authenticated users can view price book entries" 
ON public.price_book_entries FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Admin can manage price book entries" 
ON public.price_book_entries FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- RLS Policies for distributor_price_books
CREATE POLICY "Authenticated users can view distributor price books" 
ON public.distributor_price_books FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Admin can manage distributor price books" 
ON public.distributor_price_books FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_price_books_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_price_books_timestamp
BEFORE UPDATE ON public.price_books
FOR EACH ROW EXECUTE FUNCTION public.update_price_books_updated_at();

CREATE TRIGGER update_price_book_entries_timestamp
BEFORE UPDATE ON public.price_book_entries
FOR EACH ROW EXECUTE FUNCTION public.update_price_books_updated_at();

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_price_books_type ON public.price_books(price_book_type);
CREATE INDEX IF NOT EXISTS idx_price_books_active ON public.price_books(is_active);
CREATE INDEX IF NOT EXISTS idx_price_book_entries_price_book ON public.price_book_entries(price_book_id);
CREATE INDEX IF NOT EXISTS idx_distributor_price_books_distributor ON public.distributor_price_books(distributor_id);
CREATE INDEX IF NOT EXISTS idx_distributor_price_books_active ON public.distributor_price_books(is_active);
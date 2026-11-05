-- Create competition master table
CREATE TABLE IF NOT EXISTS public.competition_master (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competitor_name TEXT NOT NULL,
  business_background TEXT,
  key_financial_stats JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create competition SKUs table
CREATE TABLE IF NOT EXISTS public.competition_skus (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competitor_id UUID NOT NULL REFERENCES public.competition_master(id) ON DELETE CASCADE,
  sku_name TEXT NOT NULL,
  unit TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create competition contacts table
CREATE TABLE IF NOT EXISTS public.competition_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competitor_id UUID NOT NULL REFERENCES public.competition_master(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  contact_phone TEXT,
  contact_email TEXT,
  designation TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create competition data table (captured at retailer level)
CREATE TABLE IF NOT EXISTS public.competition_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  retailer_id UUID NOT NULL,
  visit_id UUID,
  competitor_id UUID NOT NULL REFERENCES public.competition_master(id) ON DELETE CASCADE,
  sku_id UUID REFERENCES public.competition_skus(id) ON DELETE SET NULL,
  stock_quantity INTEGER DEFAULT 0,
  unit TEXT,
  insight TEXT,
  impact_level TEXT,
  needs_attention BOOLEAN DEFAULT false,
  photo_urls TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.competition_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies for competition_master
CREATE POLICY "Admins can manage competition master"
  ON public.competition_master
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view competition master"
  ON public.competition_master
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for competition_skus
CREATE POLICY "Admins can manage competition SKUs"
  ON public.competition_skus
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view competition SKUs"
  ON public.competition_skus
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for competition_contacts
CREATE POLICY "Admins can manage competition contacts"
  ON public.competition_contacts
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view competition contacts"
  ON public.competition_contacts
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for competition_data
CREATE POLICY "Users can create their own competition data"
  ON public.competition_data
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own competition data"
  ON public.competition_data
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own competition data"
  ON public.competition_data
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all competition data"
  ON public.competition_data
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_competition_skus_competitor_id ON public.competition_skus(competitor_id);
CREATE INDEX IF NOT EXISTS idx_competition_contacts_competitor_id ON public.competition_contacts(competitor_id);
CREATE INDEX IF NOT EXISTS idx_competition_data_retailer_id ON public.competition_data(retailer_id);
CREATE INDEX IF NOT EXISTS idx_competition_data_visit_id ON public.competition_data(visit_id);
CREATE INDEX IF NOT EXISTS idx_competition_data_user_id ON public.competition_data(user_id);
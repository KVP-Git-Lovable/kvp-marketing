-- Create stock_cycle_data table for tracking product stock and orders per visit
CREATE TABLE IF NOT EXISTS public.stock_cycle_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  retailer_id UUID NOT NULL,
  visit_id UUID,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  ordered_quantity INTEGER DEFAULT 0,
  stock_quantity INTEGER DEFAULT 0,
  visit_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stock_cycle_data ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own stock cycle data"
  ON public.stock_cycle_data
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own stock cycle data"
  ON public.stock_cycle_data
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stock cycle data"
  ON public.stock_cycle_data
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_stock_cycle_data_user_retailer ON public.stock_cycle_data(user_id, retailer_id);
CREATE INDEX idx_stock_cycle_data_visit_date ON public.stock_cycle_data(visit_date);
CREATE INDEX idx_stock_cycle_data_product ON public.stock_cycle_data(product_id);

-- Create trigger for updated_at
CREATE TRIGGER update_stock_cycle_data_updated_at
  BEFORE UPDATE ON public.stock_cycle_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
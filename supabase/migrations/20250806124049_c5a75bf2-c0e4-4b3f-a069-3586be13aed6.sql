-- Create beat_plans table for storing journey planning data
CREATE TABLE public.beat_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_date DATE NOT NULL,
  beat_id TEXT NOT NULL,
  beat_name TEXT NOT NULL,
  beat_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, plan_date, beat_id)
);

-- Enable Row Level Security
ALTER TABLE public.beat_plans ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own beat plans" 
ON public.beat_plans 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own beat plans" 
ON public.beat_plans 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own beat plans" 
ON public.beat_plans 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own beat plans" 
ON public.beat_plans 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_beat_plans_updated_at
BEFORE UPDATE ON public.beat_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create retailers table for beat-retailer mapping
CREATE TABLE public.retailers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  beat_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT,
  category TEXT,
  priority TEXT DEFAULT 'medium',
  last_visit_date DATE,
  order_value NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for retailers
ALTER TABLE public.retailers ENABLE ROW LEVEL SECURITY;

-- Create policies for retailers
CREATE POLICY "Users can view their own retailers" 
ON public.retailers 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own retailers" 
ON public.retailers 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own retailers" 
ON public.retailers 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own retailers" 
ON public.retailers 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for retailers timestamp updates
CREATE TRIGGER update_retailers_updated_at
BEFORE UPDATE ON public.retailers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some sample retailers for different beats
INSERT INTO public.retailers (user_id, beat_id, name, address, phone, category, priority, order_value) VALUES
('00000000-0000-0000-0000-000000000000', '1', 'Vardhman Kirana', 'Indiranagar, Bangalore', '9926612072', 'Category A', 'high', 15000),
('00000000-0000-0000-0000-000000000000', '1', 'Mahesh Kirana and General Stores', 'MG Road, Bangalore', '9955551112', 'Category A', 'high', 22000),
('00000000-0000-0000-0000-000000000000', '2', 'Sham Kirana and General Stores', '34 A, Kharghar, Navi Mumbai, Maharashtra 410210', '9926963147', 'Category B', 'medium', 0),
('00000000-0000-0000-0000-000000000000', '2', 'Balaji Kiranad', 'Commercial Street, Bangalore', '9516584711', 'Category C', 'low', 0),
('00000000-0000-0000-0000-000000000000', '3', 'New Mart', 'Brigade Road, Bangalore', '9876543210', 'Category B', 'medium', 0);
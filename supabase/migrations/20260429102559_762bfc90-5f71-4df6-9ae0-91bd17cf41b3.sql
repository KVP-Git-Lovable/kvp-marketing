-- Create dedicated table for Counter Sales walk-in customers (separate from retailers)
CREATE TABLE IF NOT EXISTS public.counter_customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_counter_customers_user ON public.counter_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_counter_customers_phone ON public.counter_customers(phone);
CREATE INDEX IF NOT EXISTS idx_counter_customers_name ON public.counter_customers(name);

ALTER TABLE public.counter_customers ENABLE ROW LEVEL SECURITY;

-- Owner can view their own counter customers
CREATE POLICY "Users can view their own counter customers"
ON public.counter_customers
FOR SELECT
USING (auth.uid()::text = user_id::text);

-- System admins can view all
CREATE POLICY "System admins can view all counter customers"
ON public.counter_customers
FOR SELECT
USING (public.is_system_admin(auth.uid()));

-- Owner can insert
CREATE POLICY "Users can create their own counter customers"
ON public.counter_customers
FOR INSERT
WITH CHECK (auth.uid()::text = user_id::text);

-- Owner can update
CREATE POLICY "Users can update their own counter customers"
ON public.counter_customers
FOR UPDATE
USING (auth.uid()::text = user_id::text);

-- Owner can delete
CREATE POLICY "Users can delete their own counter customers"
ON public.counter_customers
FOR DELETE
USING (auth.uid()::text = user_id::text);

-- updated_at trigger
CREATE TRIGGER trg_counter_customers_updated_at
BEFORE UPDATE ON public.counter_customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
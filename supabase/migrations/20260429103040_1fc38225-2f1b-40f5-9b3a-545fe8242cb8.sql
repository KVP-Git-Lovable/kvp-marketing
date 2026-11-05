ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS counter_customer_id UUID NULL REFERENCES public.counter_customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_counter_customer ON public.orders(counter_customer_id);
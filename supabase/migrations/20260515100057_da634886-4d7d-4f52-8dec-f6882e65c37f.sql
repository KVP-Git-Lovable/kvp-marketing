ALTER TABLE public.order_items ADD COLUMN order_id uuid;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
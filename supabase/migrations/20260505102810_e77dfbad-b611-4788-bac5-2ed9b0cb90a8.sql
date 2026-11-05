
-- Event stock tracking tables
CREATE TABLE public.event_stock_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.activity_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  day_number INTEGER NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, day_number)
);

CREATE TABLE public.event_stock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_stock_day_id UUID NOT NULL REFERENCES public.event_stock_days(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  stock_taken NUMERIC NOT NULL DEFAULT 0,
  sold_qty NUMERIC NOT NULL DEFAULT 0,
  price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_stock_day_id, product_id)
);

CREATE INDEX idx_event_stock_days_event ON public.event_stock_days(event_id);
CREATE INDEX idx_event_stock_items_day ON public.event_stock_items(event_stock_day_id);

ALTER TABLE public.event_stock_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_stock_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own event stock days"
  ON public.event_stock_days FOR ALL
  USING (auth.uid() = user_id OR public.is_system_admin(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_system_admin(auth.uid()));

CREATE POLICY "Users manage own event stock items"
  ON public.event_stock_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.event_stock_days d
      WHERE d.id = event_stock_day_id
        AND (d.user_id = auth.uid() OR public.is_system_admin(auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_stock_days d
      WHERE d.id = event_stock_day_id
        AND (d.user_id = auth.uid() OR public.is_system_admin(auth.uid()))
    )
  );

CREATE TRIGGER update_event_stock_days_updated_at
  BEFORE UPDATE ON public.event_stock_days
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_stock_items_updated_at
  BEFORE UPDATE ON public.event_stock_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

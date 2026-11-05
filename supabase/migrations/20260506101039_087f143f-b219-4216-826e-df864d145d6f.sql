ALTER TABLE public.event_stock_audit ADD COLUMN IF NOT EXISTS order_item_id uuid;
CREATE INDEX IF NOT EXISTS idx_event_stock_audit_order_item ON public.event_stock_audit(order_item_id);

CREATE OR REPLACE FUNCTION public.trg_apply_event_stock_after_order_items()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order RECORD; v_event_id uuid; v_day_id uuid;
  v_row RECORD; v_pid uuid; v_price numeric;
BEGIN
  IF EXISTS (SELECT 1 FROM public.event_stock_audit WHERE order_item_id = NEW.id) THEN RETURN NEW; END IF;
  SELECT id, visit_id, order_date, status, user_id INTO v_order FROM public.orders WHERE id = NEW.order_id;
  IF v_order.visit_id IS NULL OR v_order.status = 'cancelled' THEN RETURN NEW; END IF;
  IF NEW.product_id IS NULL OR NEW.quantity <= 0 THEN RETURN NEW; END IF;
  BEGIN v_pid := NEW.product_id::uuid; EXCEPTION WHEN OTHERS THEN RETURN NEW; END;

  SELECT id INTO v_event_id FROM public.activity_events WHERE visit_id = v_order.visit_id LIMIT 1;
  IF v_event_id IS NULL THEN RETURN NEW; END IF;
  SELECT id INTO v_day_id FROM public.event_stock_days WHERE event_id = v_event_id AND date = v_order.order_date LIMIT 1;
  IF v_day_id IS NULL THEN
    SELECT id INTO v_day_id FROM public.event_stock_days WHERE event_id = v_event_id ORDER BY day_number ASC LIMIT 1;
  END IF;
  IF v_day_id IS NULL THEN RETURN NEW; END IF;

  SELECT id, sold_qty INTO v_row FROM public.event_stock_items
  WHERE event_stock_day_id = v_day_id AND product_id = v_pid FOR UPDATE;
  IF NOT FOUND THEN
    v_price := COALESCE(NEW.rate, (SELECT rate FROM public.products WHERE id = v_pid), 0);
    INSERT INTO public.event_stock_items(event_stock_day_id, product_id, stock_taken, sold_qty, price)
    VALUES (v_day_id, v_pid, 0, 0, v_price) RETURNING id, sold_qty INTO v_row;
  END IF;
  UPDATE public.event_stock_items SET sold_qty = v_row.sold_qty + NEW.quantity, updated_at = now() WHERE id = v_row.id;
  INSERT INTO public.event_stock_audit(event_stock_item_id, event_id, event_stock_day_id, product_id, order_id, order_item_id, visit_id, user_id, delta_qty, prev_sold_qty, new_sold_qty, source)
  VALUES (v_row.id, v_event_id, v_day_id, v_pid, v_order.id, NEW.id, v_order.visit_id, v_order.user_id, NEW.quantity, v_row.sold_qty, v_row.sold_qty + NEW.quantity, 'order_submit');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'event-stock trigger failed for order_item %: %', NEW.id, SQLERRM;
  RETURN NEW;
END; $$;

DO $$
DECLARE
  rec RECORD; v_day_id uuid; v_event_id uuid; v_row RECORD; v_pid uuid; v_price numeric;
BEGIN
  DELETE FROM public.event_stock_audit a
  USING public.event_stock_days d, public.activity_events e
  WHERE a.event_stock_day_id = d.id AND d.event_id = e.id;

  UPDATE public.event_stock_items SET sold_qty = 0
  WHERE event_stock_day_id IN (SELECT id FROM public.event_stock_days);

  FOR rec IN
    SELECT oi2.id AS oi_id, oi2.product_id AS pid, oi2.quantity AS qty, oi2.rate AS rt,
           o2.id AS oid, o2.visit_id AS vid, o2.order_date AS odate, o2.user_id AS uid
    FROM public.order_items oi2 JOIN public.orders o2 ON o2.id = oi2.order_id
    WHERE o2.visit_id IS NOT NULL AND o2.status <> 'cancelled'
      AND oi2.product_id IS NOT NULL AND oi2.quantity > 0
      AND EXISTS (SELECT 1 FROM public.activity_events ae WHERE ae.visit_id = o2.visit_id)
  LOOP
    BEGIN v_pid := rec.pid::uuid; EXCEPTION WHEN OTHERS THEN CONTINUE; END;
    SELECT ae.id INTO v_event_id FROM public.activity_events ae WHERE ae.visit_id = rec.vid LIMIT 1;
    SELECT id INTO v_day_id FROM public.event_stock_days WHERE event_id = v_event_id AND date = rec.odate LIMIT 1;
    IF v_day_id IS NULL THEN
      SELECT id INTO v_day_id FROM public.event_stock_days WHERE event_id = v_event_id ORDER BY day_number ASC LIMIT 1;
    END IF;
    IF v_day_id IS NULL THEN CONTINUE; END IF;

    SELECT id, sold_qty INTO v_row FROM public.event_stock_items
    WHERE event_stock_day_id = v_day_id AND product_id = v_pid FOR UPDATE;
    IF NOT FOUND THEN
      v_price := COALESCE(rec.rt, (SELECT rate FROM public.products WHERE id = v_pid), 0);
      INSERT INTO public.event_stock_items(event_stock_day_id, product_id, stock_taken, sold_qty, price)
      VALUES (v_day_id, v_pid, 0, 0, v_price) RETURNING id, sold_qty INTO v_row;
    END IF;
    UPDATE public.event_stock_items SET sold_qty = v_row.sold_qty + rec.qty, updated_at = now() WHERE id = v_row.id;
    INSERT INTO public.event_stock_audit(event_stock_item_id, event_id, event_stock_day_id, product_id, order_id, order_item_id, visit_id, user_id, delta_qty, prev_sold_qty, new_sold_qty, source)
    VALUES (v_row.id, v_event_id, v_day_id, v_pid, rec.oid, rec.oi_id, rec.vid, rec.uid, rec.qty, v_row.sold_qty, v_row.sold_qty + rec.qty, 'resync');
  END LOOP;
END $$;
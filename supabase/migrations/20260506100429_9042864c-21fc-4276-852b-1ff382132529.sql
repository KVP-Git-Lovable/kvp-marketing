DO $$
DECLARE
  ord RECORD;
  v_event_id uuid;
  v_day_id uuid;
  v_row RECORD;
  v_item RECORD;
  v_pid uuid;
  v_price numeric;
BEGIN
  FOR ord IN
    SELECT id, visit_id, order_date, user_id FROM public.orders
    WHERE visit_id IS NOT NULL AND status <> 'cancelled'
  LOOP
    SELECT id INTO v_event_id FROM public.activity_events WHERE visit_id = ord.visit_id LIMIT 1;
    IF v_event_id IS NULL THEN CONTINUE; END IF;

    SELECT id INTO v_day_id FROM public.event_stock_days
    WHERE event_id = v_event_id AND date = ord.order_date LIMIT 1;
    IF v_day_id IS NULL THEN
      SELECT id INTO v_day_id FROM public.event_stock_days WHERE event_id = v_event_id ORDER BY day_number ASC LIMIT 1;
    END IF;
    IF v_day_id IS NULL THEN CONTINUE; END IF;

    FOR v_item IN
      SELECT product_id, quantity, rate FROM public.order_items
      WHERE order_id = ord.id AND product_id IS NOT NULL AND quantity > 0
    LOOP
      BEGIN v_pid := v_item.product_id::uuid; EXCEPTION WHEN OTHERS THEN CONTINUE; END;
      IF EXISTS (SELECT 1 FROM public.event_stock_audit WHERE order_id = ord.id AND product_id = v_pid) THEN CONTINUE; END IF;

      SELECT id, stock_taken, sold_qty INTO v_row FROM public.event_stock_items
      WHERE event_stock_day_id = v_day_id AND product_id = v_pid FOR UPDATE;
      IF NOT FOUND THEN
        v_price := COALESCE(v_item.rate, (SELECT rate FROM public.products WHERE id = v_pid), 0);
        INSERT INTO public.event_stock_items(event_stock_day_id, product_id, stock_taken, sold_qty, price)
        VALUES (v_day_id, v_pid, 0, 0, v_price)
        RETURNING id, stock_taken, sold_qty INTO v_row;
      END IF;
      UPDATE public.event_stock_items SET sold_qty = v_row.sold_qty + v_item.quantity, updated_at = now() WHERE id = v_row.id;
      INSERT INTO public.event_stock_audit(event_stock_item_id, event_id, event_stock_day_id, product_id, order_id, visit_id, user_id, delta_qty, prev_sold_qty, new_sold_qty, source)
      VALUES (v_row.id, v_event_id, v_day_id, v_pid, ord.id, ord.visit_id, ord.user_id, v_item.quantity, v_row.sold_qty, v_row.sold_qty + v_item.quantity, 'backfill_rerun');
    END LOOP;
  END LOOP;
END $$;
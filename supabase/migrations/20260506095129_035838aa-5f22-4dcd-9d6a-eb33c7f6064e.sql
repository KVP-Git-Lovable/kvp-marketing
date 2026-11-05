CREATE OR REPLACE FUNCTION public.trg_apply_event_stock_after_order_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_event_id uuid;
  v_day_id uuid;
  v_already int;
  v_row RECORD;
  v_item RECORD;
  v_pid uuid;
BEGIN
  SELECT id, visit_id, order_date, status, user_id INTO v_order FROM public.orders WHERE id = NEW.order_id;
  IF v_order.visit_id IS NULL OR v_order.status = 'cancelled' THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_already FROM public.event_stock_audit WHERE order_id = v_order.id;
  IF v_already > 0 THEN RETURN NEW; END IF;

  SELECT id INTO v_event_id FROM public.activity_events WHERE visit_id = v_order.visit_id LIMIT 1;
  IF v_event_id IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_day_id FROM public.event_stock_days
  WHERE event_id = v_event_id AND date = v_order.order_date LIMIT 1;
  IF v_day_id IS NULL THEN
    SELECT id INTO v_day_id FROM public.event_stock_days
    WHERE event_id = v_event_id ORDER BY day_number ASC LIMIT 1;
  END IF;
  IF v_day_id IS NULL THEN RETURN NEW; END IF;

  FOR v_item IN
    SELECT product_id, quantity FROM public.order_items
    WHERE order_id = v_order.id AND product_id IS NOT NULL AND quantity > 0
  LOOP
    BEGIN
      v_pid := v_item.product_id::uuid;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;

    SELECT id, stock_taken, sold_qty INTO v_row
    FROM public.event_stock_items
    WHERE event_stock_day_id = v_day_id AND product_id = v_pid
    FOR UPDATE;

    IF NOT FOUND THEN CONTINUE; END IF;

    UPDATE public.event_stock_items
       SET sold_qty = v_row.sold_qty + v_item.quantity, updated_at = now()
     WHERE id = v_row.id;

    INSERT INTO public.event_stock_audit(
      event_stock_item_id, event_id, event_stock_day_id, product_id,
      order_id, visit_id, user_id, delta_qty, prev_sold_qty, new_sold_qty, source
    ) VALUES (
      v_row.id, v_event_id, v_day_id, v_pid,
      v_order.id, v_order.visit_id, v_order.user_id,
      v_item.quantity, v_row.sold_qty, v_row.sold_qty + v_item.quantity, 'order_submit'
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'event-stock trigger failed for order %: %', NEW.order_id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_stock_on_order_items ON public.order_items;
CREATE TRIGGER trg_event_stock_on_order_items
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_apply_event_stock_after_order_items();

-- Backfill
DO $$
DECLARE
  o RECORD;
  v_event_id uuid;
  v_day_id uuid;
  v_row RECORD;
  v_item RECORD;
  v_pid uuid;
BEGIN
  FOR o IN
    SELECT id, visit_id, order_date, user_id FROM public.orders
    WHERE visit_id IS NOT NULL AND status <> 'cancelled'
      AND NOT EXISTS (SELECT 1 FROM public.event_stock_audit a WHERE a.order_id = orders.id)
  LOOP
    SELECT id INTO v_event_id FROM public.activity_events WHERE visit_id = o.visit_id LIMIT 1;
    IF v_event_id IS NULL THEN CONTINUE; END IF;

    SELECT id INTO v_day_id FROM public.event_stock_days
    WHERE event_id = v_event_id AND date = o.order_date LIMIT 1;
    IF v_day_id IS NULL THEN
      SELECT id INTO v_day_id FROM public.event_stock_days
      WHERE event_id = v_event_id ORDER BY day_number ASC LIMIT 1;
    END IF;
    IF v_day_id IS NULL THEN CONTINUE; END IF;

    FOR v_item IN
      SELECT product_id, quantity FROM public.order_items
      WHERE order_id = o.id AND product_id IS NOT NULL AND quantity > 0
    LOOP
      BEGIN v_pid := v_item.product_id::uuid; EXCEPTION WHEN OTHERS THEN CONTINUE; END;

      SELECT id, stock_taken, sold_qty INTO v_row
      FROM public.event_stock_items
      WHERE event_stock_day_id = v_day_id AND product_id = v_pid
      FOR UPDATE;
      IF NOT FOUND THEN CONTINUE; END IF;

      UPDATE public.event_stock_items
         SET sold_qty = v_row.sold_qty + v_item.quantity, updated_at = now()
       WHERE id = v_row.id;

      INSERT INTO public.event_stock_audit(
        event_stock_item_id, event_id, event_stock_day_id, product_id,
        order_id, visit_id, user_id, delta_qty, prev_sold_qty, new_sold_qty, source
      ) VALUES (
        v_row.id, v_event_id, v_day_id, v_pid,
        o.id, o.visit_id, o.user_id,
        v_item.quantity, v_row.sold_qty, v_row.sold_qty + v_item.quantity, 'backfill'
      );
    END LOOP;
  END LOOP;
END $$;
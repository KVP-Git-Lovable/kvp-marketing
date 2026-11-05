-- Audit trail for event stock auto-updates
CREATE TABLE IF NOT EXISTS public.event_stock_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_stock_item_id uuid NOT NULL REFERENCES public.event_stock_items(id) ON DELETE CASCADE,
  event_id uuid NOT NULL,
  event_stock_day_id uuid NOT NULL,
  product_id uuid NOT NULL,
  order_id uuid,
  visit_id uuid,
  user_id uuid NOT NULL,
  delta_qty numeric NOT NULL,
  prev_sold_qty numeric NOT NULL,
  new_sold_qty numeric NOT NULL,
  source text NOT NULL DEFAULT 'order_submit',
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_stock_audit_event ON public.event_stock_audit(event_id);
CREATE INDEX IF NOT EXISTS idx_event_stock_audit_order ON public.event_stock_audit(order_id);
CREATE INDEX IF NOT EXISTS idx_event_stock_audit_user ON public.event_stock_audit(user_id);

ALTER TABLE public.event_stock_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit readable by owner or admin"
  ON public.event_stock_audit
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_system_admin(auth.uid()));

-- RPC: atomically apply order quantities to event stock items
CREATE OR REPLACE FUNCTION public.apply_event_stock_for_order(
  p_visit_id uuid,
  p_order_id uuid,
  p_order_date date,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_day_id uuid;
  v_user uuid := auth.uid();
  v_item jsonb;
  v_product uuid;
  v_qty numeric;
  v_row record;
  v_updated int := 0;
  v_skipped int := 0;
  v_warnings jsonb := '[]'::jsonb;
  v_idempo int;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_visit_id IS NULL OR p_items IS NULL THEN
    RETURN jsonb_build_object('updated',0,'skipped',0,'warnings','[]'::jsonb);
  END IF;

  -- Resolve event for this visit
  SELECT id INTO v_event_id
  FROM public.activity_events
  WHERE visit_id = p_visit_id
  LIMIT 1;
  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('updated',0,'skipped',0,'warnings',jsonb_build_array('No event linked to visit'));
  END IF;

  -- Pick stock day matching order date, else day 1
  SELECT id INTO v_day_id
  FROM public.event_stock_days
  WHERE event_id = v_event_id AND date = p_order_date
  LIMIT 1;
  IF v_day_id IS NULL THEN
    SELECT id INTO v_day_id
    FROM public.event_stock_days
    WHERE event_id = v_event_id
    ORDER BY day_number ASC
    LIMIT 1;
  END IF;
  IF v_day_id IS NULL THEN
    RETURN jsonb_build_object('updated',0,'skipped',0,'warnings',jsonb_build_array('No stock day initialized for event'));
  END IF;

  -- Idempotency: if any audit rows already recorded for this order, skip
  SELECT count(*) INTO v_idempo FROM public.event_stock_audit WHERE order_id = p_order_id;
  IF v_idempo > 0 THEN
    RETURN jsonb_build_object('updated',0,'skipped',0,'warnings',jsonb_build_array('Already applied for this order'));
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product := (v_item->>'product_id')::uuid;
    v_qty := COALESCE((v_item->>'quantity')::numeric, 0);
    IF v_product IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    SELECT id, stock_taken, sold_qty
      INTO v_row
    FROM public.event_stock_items
    WHERE event_stock_day_id = v_day_id
      AND product_id = v_product
    FOR UPDATE;

    IF NOT FOUND THEN
      v_skipped := v_skipped + 1;
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('product_id',v_product,'reason','No stock row'));
      CONTINUE;
    END IF;

    UPDATE public.event_stock_items
       SET sold_qty = v_row.sold_qty + v_qty,
           updated_at = now()
     WHERE id = v_row.id;

    INSERT INTO public.event_stock_audit(
      event_stock_item_id, event_id, event_stock_day_id, product_id,
      order_id, visit_id, user_id, delta_qty, prev_sold_qty, new_sold_qty, source
    ) VALUES (
      v_row.id, v_event_id, v_day_id, v_product,
      p_order_id, p_visit_id, v_user, v_qty, v_row.sold_qty, v_row.sold_qty + v_qty, 'order_submit'
    );

    IF (v_row.sold_qty + v_qty) > v_row.stock_taken THEN
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('product_id',v_product,'reason','Sold exceeds stock taken'));
    END IF;

    v_updated := v_updated + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'updated', v_updated,
    'skipped', v_skipped,
    'event_id', v_event_id,
    'event_stock_day_id', v_day_id,
    'warnings', v_warnings
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_event_stock_for_order(uuid, uuid, date, jsonb) TO authenticated;
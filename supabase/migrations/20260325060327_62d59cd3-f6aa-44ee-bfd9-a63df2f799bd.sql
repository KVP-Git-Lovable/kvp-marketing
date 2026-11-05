
-- 1. Create credit_ledger table
CREATE TABLE public.credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('order_credit', 'order_cancel', 'payment', 'adjustment')),
  reference_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_ledger_retailer ON public.credit_ledger(retailer_id);
CREATE INDEX idx_credit_ledger_reference ON public.credit_ledger(reference_id);

ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view credit ledger entries"
  ON public.credit_ledger FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert credit ledger entries"
  ON public.credit_ledger FOR INSERT TO authenticated
  WITH CHECK (true);

-- 2. Create order_cancellation_log table
CREATE TABLE public.order_cancellation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  reason TEXT,
  cancelled_by UUID,
  cancelled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reversal_summary JSONB
);

CREATE INDEX idx_cancellation_log_order ON public.order_cancellation_log(order_id);

ALTER TABLE public.order_cancellation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their cancellation logs"
  ON public.order_cancellation_log FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert cancellation logs"
  ON public.order_cancellation_log FOR INSERT TO authenticated
  WITH CHECK (true);

-- 3. Add completion_source to visits
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS completion_source TEXT;

-- 4. Incremental trigger for credit_ledger -> retailers.pending_amount
CREATE OR REPLACE FUNCTION public.credit_ledger_sync_pending_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE retailers
  SET pending_amount = GREATEST(0, COALESCE(pending_amount, 0) + NEW.amount),
      updated_at = now()
  WHERE id = NEW.retailer_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_credit_ledger_sync
  AFTER INSERT ON public.credit_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.credit_ledger_sync_pending_amount();

-- 5. Atomic cancellation RPC
CREATE OR REPLACE FUNCTION public.cancel_order_atomic(
  p_order_id UUID,
  p_reason TEXT,
  p_cancelled_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_visit RECORD;
  v_remaining_orders INT;
  v_gamification_reversed NUMERIC := 0;
  v_loyalty_reversed NUMERIC := 0;
  v_credit_reversed NUMERIC := 0;
  v_visit_reverted BOOLEAN := false;
  v_invoice_cancelled BOOLEAN := false;
  v_gp RECORD;
  v_lp RECORD;
  v_points_date TEXT;
BEGIN
  -- 1. Lock the order row
  SELECT id, user_id, retailer_id, visit_id, order_date, created_at,
         total_amount, is_credit_order, credit_pending_amount, credit_paid_amount,
         status, delivery_status
  INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- 2. Idempotency check
  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'already_cancelled', true);
  END IF;

  -- 3. Validate cancellable
  IF v_order.status NOT IN ('confirmed', 'pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot cancel order with status: ' || v_order.status);
  END IF;

  IF v_order.delivery_status = 'delivered' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot cancel a delivered order');
  END IF;

  -- 4. Cancel the order
  UPDATE orders
  SET status = 'cancelled',
      cancelled_at = now(),
      cancellation_reason = p_reason,
      cancelled_by = p_cancelled_by::text,
      updated_at = now()
  WHERE id = p_order_id;

  -- 5. Cancel linked invoices
  UPDATE invoices
  SET status = 'cancelled',
      updated_at = now()
  WHERE order_id = p_order_id
    AND status != 'cancelled';
  
  IF FOUND THEN
    v_invoice_cancelled := true;
  END IF;

  -- 6. Credit reversal via ledger (if credit order)
  IF v_order.is_credit_order AND COALESCE(v_order.credit_pending_amount, 0) > 0 THEN
    v_credit_reversed := v_order.credit_pending_amount;
    
    INSERT INTO credit_ledger (retailer_id, amount, type, reference_id, created_by)
    VALUES (v_order.retailer_id, -v_credit_reversed, 'order_cancel', p_order_id, p_cancelled_by);
    -- trigger automatically updates retailers.pending_amount
  END IF;

  -- 7. Recalculate last_order_date
  UPDATE retailers
  SET last_order_date = (
        SELECT MAX(order_date) FROM orders
        WHERE retailer_id = v_order.retailer_id AND status = 'confirmed' AND id != p_order_id
      ),
      last_order_value = (
        SELECT total_amount FROM orders
        WHERE retailer_id = v_order.retailer_id AND status = 'confirmed' AND id != p_order_id
        ORDER BY order_date DESC LIMIT 1
      ),
      updated_at = now()
  WHERE id = v_order.retailer_id;

  -- 8. Visit status reversion (only if completion_source = 'order' or NULL, and no other confirmed orders)
  IF v_order.visit_id IS NOT NULL THEN
    SELECT id, status, completion_source
    INTO v_visit
    FROM visits
    WHERE id = v_order.visit_id
    FOR UPDATE;

    IF v_visit.status = 'productive' AND COALESCE(v_visit.completion_source, 'order') = 'order' THEN
      SELECT COUNT(*) INTO v_remaining_orders
      FROM orders
      WHERE visit_id = v_order.visit_id
        AND id != p_order_id
        AND status = 'confirmed';

      IF v_remaining_orders = 0 THEN
        UPDATE visits
        SET status = 'planned',
            completion_source = NULL,
            no_order_reason = NULL,
            updated_at = now()
        WHERE id = v_order.visit_id;
        v_visit_reverted := true;
      END IF;
    END IF;
  END IF;

  -- 9. Gamification reversal — INSERT negative points (by order_id reference)
  FOR v_gp IN
    SELECT id, points, action_id, game_id, user_id, reference_type
    FROM gamification_points
    WHERE reference_id = p_order_id::text
      AND reference_type IN ('order', 'visit')
  LOOP
    INSERT INTO gamification_points (action_id, game_id, user_id, points, reference_id, reference_type, earned_at, metadata)
    VALUES (v_gp.action_id, v_gp.game_id, v_gp.user_id, -v_gp.points, p_order_id::text, 'order_reversal', now(),
            jsonb_build_object('reversed_point_id', v_gp.id, 'reason', 'order_cancellation'));
    v_gamification_reversed := v_gamification_reversed + v_gp.points;
  END LOOP;

  -- Legacy fallback: if no order-linked points found, try retailer+date match
  IF v_gamification_reversed = 0 THEN
    v_points_date := to_char(v_order.created_at, 'YYYY-MM-DD');
    FOR v_gp IN
      SELECT id, points, action_id, game_id, user_id, reference_type
      FROM gamification_points
      WHERE user_id = v_order.user_id
        AND reference_id = v_order.retailer_id::text
        AND earned_at >= (v_points_date || 'T00:00:00')::timestamptz
        AND earned_at < (v_points_date || 'T23:59:59')::timestamptz
        AND points > 0
    LOOP
      INSERT INTO gamification_points (action_id, game_id, user_id, points, reference_id, reference_type, earned_at, metadata)
      VALUES (v_gp.action_id, v_gp.game_id, v_gp.user_id, -v_gp.points, p_order_id::text, 'order_reversal', now(),
              jsonb_build_object('reversed_point_id', v_gp.id, 'reason', 'order_cancellation_legacy'));
      v_gamification_reversed := v_gamification_reversed + v_gp.points;
    END LOOP;
  END IF;

  -- 10. Loyalty points reversal — INSERT negative entries
  FOR v_lp IN
    SELECT id, points, action_id, program_id, retailer_id, reference_type
    FROM retailer_loyalty_points
    WHERE reference_id = p_order_id::text
      AND reference_type = 'order'
      AND points > 0
  LOOP
    INSERT INTO retailer_loyalty_points (action_id, program_id, retailer_id, points, reference_id, reference_type, earned_at, description, metadata)
    VALUES (v_lp.action_id, v_lp.program_id, v_lp.retailer_id, -v_lp.points, p_order_id::text, 'order_reversal', now(),
            'Reversal due to order cancellation',
            jsonb_build_object('reversed_point_id', v_lp.id, 'reason', 'order_cancellation'));
    v_loyalty_reversed := v_loyalty_reversed + v_lp.points;
  END LOOP;

  -- 11. Decrement retailer sequence (no delete)
  UPDATE gamification_retailer_sequences
  SET consecutive_orders = GREATEST(0, COALESCE(consecutive_orders, 0) - 1),
      updated_at = now()
  WHERE user_id = v_order.user_id
    AND retailer_id = v_order.retailer_id;

  -- 12. Decrement daily tracking (no delete)
  UPDATE gamification_daily_tracking
  SET count = GREATEST(0, COALESCE(count, 0) - 1),
      updated_at = now()
  WHERE user_id = v_order.user_id
    AND tracking_date = to_char(v_order.created_at, 'YYYY-MM-DD');

  -- 13. Insert cancellation audit log
  INSERT INTO order_cancellation_log (order_id, reason, cancelled_by, reversal_summary)
  VALUES (p_order_id, p_reason, p_cancelled_by, jsonb_build_object(
    'credit_reversed', v_credit_reversed,
    'gamification_points_reversed', v_gamification_reversed,
    'loyalty_points_reversed', v_loyalty_reversed,
    'visit_reverted', v_visit_reverted,
    'invoice_cancelled', v_invoice_cancelled
  ));

  -- 14. Return summary
  RETURN jsonb_build_object(
    'success', true,
    'already_cancelled', false,
    'visit_reverted', v_visit_reverted,
    'credit_reversed', v_credit_reversed,
    'gamification_points_reversed', v_gamification_reversed,
    'loyalty_points_reversed', v_loyalty_reversed,
    'invoice_cancelled', v_invoice_cancelled,
    'retailer_id', v_order.retailer_id,
    'user_id', v_order.user_id,
    'order_date', v_order.order_date,
    'visit_id', v_order.visit_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

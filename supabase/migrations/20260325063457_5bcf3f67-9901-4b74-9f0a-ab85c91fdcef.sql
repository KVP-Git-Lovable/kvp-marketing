CREATE OR REPLACE FUNCTION public.cancel_order_atomic(p_order_id uuid, p_reason text, p_cancelled_by uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  v_visit RECORD;
  v_credit_reversed NUMERIC := 0;
  v_gamification_points_reversed NUMERIC := 0;
  v_loyalty_points_reversed NUMERIC := 0;
  v_invoice_cancelled BOOLEAN := false;
  v_visit_reverted BOOLEAN := false;
  v_other_confirmed_orders INT;
  v_gam_row RECORD;
  v_loyalty_row RECORD;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'already_cancelled', true);
  END IF;

  IF v_order.status NOT IN ('confirmed', 'pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot cancel order with status: ' || v_order.status);
  END IF;

  UPDATE orders SET
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = p_reason,
    cancelled_by = p_cancelled_by,
    updated_at = now()
  WHERE id = p_order_id;

  UPDATE invoices SET
    status = 'cancelled',
    updated_at = now()
  WHERE order_id = p_order_id AND status != 'cancelled';

  IF FOUND THEN
    v_invoice_cancelled := true;
  END IF;

  IF v_order.is_credit_order AND v_order.credit_pending_amount > 0 THEN
    v_credit_reversed := v_order.credit_pending_amount;

    INSERT INTO credit_ledger (retailer_id, amount, type, reference_id, created_by)
    VALUES (v_order.retailer_id, -v_credit_reversed, 'order_cancel', p_order_id, p_cancelled_by);
  END IF;

  UPDATE retailers SET
    last_order_date = (
      SELECT MAX(order_date) FROM orders
      WHERE retailer_id = v_order.retailer_id
      AND status = 'confirmed'
      AND id != p_order_id
    ),
    updated_at = now()
  WHERE id = v_order.retailer_id;

  IF v_order.visit_id IS NOT NULL THEN
    SELECT * INTO v_visit FROM visits WHERE id = v_order.visit_id;

    IF FOUND AND v_visit.status = 'productive' AND COALESCE(v_visit.completion_source, 'order') = 'order' THEN
      SELECT COUNT(*) INTO v_other_confirmed_orders
      FROM orders
      WHERE visit_id = v_order.visit_id
      AND id != p_order_id
      AND status = 'confirmed';

      IF v_other_confirmed_orders = 0 THEN
        UPDATE visits SET
          status = 'planned',
          completion_source = NULL,
          updated_at = now()
        WHERE id = v_order.visit_id;

        v_visit_reverted := true;
      END IF;
    END IF;
  END IF;

  -- Gamification reversal using real table schema
  FOR v_gam_row IN
    SELECT game_id, user_id, action_id, SUM(points) AS points_to_reverse
    FROM gamification_points
    WHERE reference_id = p_order_id
      AND reference_type = 'order'
      AND points > 0
    GROUP BY game_id, user_id, action_id
  LOOP
    INSERT INTO gamification_points (
      game_id,
      user_id,
      action_id,
      points,
      reference_type,
      reference_id,
      earned_at,
      metadata
    ) VALUES (
      v_gam_row.game_id,
      v_gam_row.user_id,
      v_gam_row.action_id,
      -v_gam_row.points_to_reverse,
      'order',
      p_order_id,
      now(),
      jsonb_build_object('type', 'order_cancellation_reversal', 'order_id', p_order_id)
    );

    v_gamification_points_reversed := v_gamification_points_reversed + v_gam_row.points_to_reverse;
  END LOOP;

  -- Loyalty reversal using real table schema
  FOR v_loyalty_row IN
    SELECT
      program_id,
      retailer_id,
      action_id,
      COALESCE(awarded_by_user_id, p_cancelled_by) AS awarded_by_user_id,
      SUM(points) AS points_to_reverse
    FROM retailer_loyalty_points
    WHERE reference_id = p_order_id
      AND points > 0
    GROUP BY program_id, retailer_id, action_id, COALESCE(awarded_by_user_id, p_cancelled_by)
  LOOP
    INSERT INTO retailer_loyalty_points (
      program_id,
      retailer_id,
      action_id,
      points,
      reference_type,
      reference_id,
      earned_at,
      awarded_by_user_id,
      metadata,
      description,
      visit_id
    ) VALUES (
      v_loyalty_row.program_id,
      v_loyalty_row.retailer_id,
      v_loyalty_row.action_id,
      -v_loyalty_row.points_to_reverse,
      'order',
      p_order_id,
      now(),
      v_loyalty_row.awarded_by_user_id,
      jsonb_build_object('type', 'order_cancellation_reversal', 'order_id', p_order_id),
      'Order cancellation reversal',
      v_order.visit_id
    );

    v_loyalty_points_reversed := v_loyalty_points_reversed + v_loyalty_row.points_to_reverse;
  END LOOP;

  UPDATE gamification_retailer_sequences
  SET consecutive_orders = GREATEST(0, consecutive_orders - 1),
      updated_at = now()
  WHERE user_id = v_order.user_id
  AND retailer_id = v_order.retailer_id;

  UPDATE gamification_daily_tracking
  SET count = GREATEST(0, count - 1),
      updated_at = now()
  WHERE user_id = v_order.user_id
  AND tracking_date = v_order.order_date;

  INSERT INTO order_cancellation_log (order_id, reason, cancelled_by, reversal_summary)
  VALUES (
    p_order_id,
    p_reason,
    p_cancelled_by,
    jsonb_build_object(
      'credit_reversed', v_credit_reversed,
      'gamification_points_reversed', v_gamification_points_reversed,
      'loyalty_points_reversed', v_loyalty_points_reversed,
      'invoice_cancelled', v_invoice_cancelled,
      'visit_reverted', v_visit_reverted,
      'retailer_id', v_order.retailer_id,
      'order_date', v_order.order_date
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'credit_reversed', v_credit_reversed,
    'gamification_points_reversed', v_gamification_points_reversed,
    'loyalty_points_reversed', v_loyalty_points_reversed,
    'invoice_cancelled', v_invoice_cancelled,
    'visit_reverted', v_visit_reverted,
    'retailer_id', v_order.retailer_id,
    'order_date', v_order.order_date
  );
END;
$function$;
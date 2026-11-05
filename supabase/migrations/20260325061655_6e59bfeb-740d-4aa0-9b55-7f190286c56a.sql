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
  v_credit_reversed NUMERIC := 0;
  v_gamification_points_reversed NUMERIC := 0;
  v_loyalty_points_reversed NUMERIC := 0;
  v_invoice_cancelled BOOLEAN := false;
  v_visit_reverted BOOLEAN := false;
  v_other_confirmed_orders INT;
  v_gam_points NUMERIC;
  v_loyalty_points NUMERIC;
BEGIN
  -- 1. Lock the order row
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  
  -- 2. Already cancelled check
  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'already_cancelled', true);
  END IF;
  
  -- 3. Status validation
  IF v_order.status NOT IN ('confirmed', 'pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot cancel order with status: ' || v_order.status);
  END IF;
  
  -- 4. Update order status
  UPDATE orders SET
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = p_reason,
    cancelled_by = p_cancelled_by,
    updated_at = now()
  WHERE id = p_order_id;
  
  -- 5. Cancel linked invoices
  UPDATE invoices SET
    status = 'cancelled',
    updated_at = now()
  WHERE order_id = p_order_id AND status != 'cancelled';
  
  IF FOUND THEN
    v_invoice_cancelled := true;
  END IF;
  
  -- 6. Credit reversal via ledger
  IF v_order.is_credit_order AND v_order.credit_pending_amount > 0 THEN
    v_credit_reversed := v_order.credit_pending_amount;
    
    INSERT INTO credit_ledger (retailer_id, amount, type, reference_id, created_by)
    VALUES (v_order.retailer_id, -v_credit_reversed, 'order_cancel', p_order_id, p_cancelled_by);
  END IF;
  
  -- 7. Recalculate last_order_date
  UPDATE retailers SET
    last_order_date = (
      SELECT MAX(order_date) FROM orders 
      WHERE retailer_id = v_order.retailer_id 
      AND status = 'confirmed'
      AND id != p_order_id
    ),
    updated_at = now()
  WHERE id = v_order.retailer_id;
  
  -- 8. Visit status — only revert if completion_source = 'order'
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
  
  -- 9. Gamification reversal — by order_id reference
  SELECT COALESCE(SUM(points), 0) INTO v_gam_points
  FROM gamification_points
  WHERE reference_id = p_order_id::text
  AND reference_type = 'order'
  AND points > 0;
  
  IF v_gam_points > 0 THEN
    INSERT INTO gamification_points (user_id, points, action, reference_id, reference_type, created_at)
    VALUES (v_order.user_id, -v_gam_points, 'order_cancellation_reversal', p_order_id::text, 'order', now());
    
    v_gamification_points_reversed := v_gam_points;
  END IF;
  
  -- 10. Loyalty points reversal
  SELECT COALESCE(SUM(points), 0) INTO v_loyalty_points
  FROM retailer_loyalty_points
  WHERE reference_id = p_order_id::text
  AND points > 0;
  
  IF v_loyalty_points > 0 THEN
    INSERT INTO retailer_loyalty_points (retailer_id, user_id, points, action, reference_id, created_at)
    VALUES (v_order.retailer_id, v_order.user_id, -v_loyalty_points, 'order_cancellation_reversal', p_order_id::text, now());
    
    v_loyalty_points_reversed := v_loyalty_points;
  END IF;
  
  -- 11. Decrement gamification sequences (no delete)
  UPDATE gamification_retailer_sequences
  SET consecutive_orders = GREATEST(0, consecutive_orders - 1),
      updated_at = now()
  WHERE user_id = v_order.user_id
  AND retailer_id = v_order.retailer_id;
  
  -- 12. Decrement daily tracking (no delete)
  UPDATE gamification_daily_tracking
  SET count = GREATEST(0, count - 1),
      updated_at = now()
  WHERE user_id = v_order.user_id
  AND date = v_order.order_date;
  
  -- 13. Insert cancellation log
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
  
  -- 14. Return summary
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
$$;

-- Single-transaction RPC to upsert order + items in one call
-- Reduces 4-5 round-trips to 1 for CREATE_ORDER sync
CREATE OR REPLACE FUNCTION public.sync_order_with_items(
  p_order jsonb,
  p_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_result jsonb;
  v_existing_order_id uuid;
  v_items_count int := 0;
BEGIN
  -- Extract order ID if present
  v_order_id := (p_order->>'id')::uuid;
  
  -- Check if order already exists by ID
  IF v_order_id IS NOT NULL THEN
    SELECT id INTO v_existing_order_id FROM orders WHERE id = v_order_id;
  END IF;
  
  IF v_existing_order_id IS NOT NULL THEN
    -- Order exists, check if items exist
    SELECT count(*) INTO v_items_count FROM order_items WHERE order_id = v_existing_order_id;
    
    IF v_items_count = 0 AND jsonb_array_length(p_items) > 0 THEN
      -- Insert missing items
      INSERT INTO order_items (
        order_id, product_id, product_name, variant_name, quantity, 
        price, total, scheme_discount, scheme_name, category_id, hsn_code
      )
      SELECT 
        v_existing_order_id,
        (item->>'product_id')::uuid,
        item->>'product_name',
        item->>'variant_name',
        COALESCE((item->>'quantity')::int, 0),
        COALESCE((item->>'price')::numeric, 0),
        COALESCE((item->>'total')::numeric, 0),
        COALESCE((item->>'scheme_discount')::numeric, 0),
        item->>'scheme_name',
        NULLIF(item->>'category_id', '')::uuid,
        item->>'hsn_code'
      FROM jsonb_array_elements(p_items) AS item;
    END IF;
    
    RETURN jsonb_build_object('order_id', v_existing_order_id, 'status', 'existing', 'items_inserted', v_items_count = 0);
  END IF;
  
  -- Insert new order
  INSERT INTO orders (
    id, user_id, retailer_id, retailer_name, visit_id, beat_name,
    order_date, total_amount, total_qty, status, payment_method,
    is_credit_order, credit_pending_amount, credit_paid_amount,
    previous_pending_cleared, invoice_number, idempotency_key,
    created_at, updated_at
  ) VALUES (
    COALESCE(v_order_id, gen_random_uuid()),
    NULLIF(p_order->>'user_id', '')::uuid,
    NULLIF(p_order->>'retailer_id', '')::uuid,
    p_order->>'retailer_name',
    NULLIF(p_order->>'visit_id', '')::uuid,
    p_order->>'beat_name',
    COALESCE(p_order->>'order_date', CURRENT_DATE::text),
    COALESCE((p_order->>'total_amount')::numeric, 0),
    COALESCE((p_order->>'total_qty')::int, 0),
    COALESCE(p_order->>'status', 'pending'),
    p_order->>'payment_method',
    COALESCE((p_order->>'is_credit_order')::boolean, false),
    COALESCE((p_order->>'credit_pending_amount')::numeric, 0),
    COALESCE((p_order->>'credit_paid_amount')::numeric, 0),
    COALESCE((p_order->>'previous_pending_cleared')::numeric, 0),
    p_order->>'invoice_number',
    p_order->>'idempotency_key',
    COALESCE((p_order->>'created_at')::timestamptz, now()),
    now()
  )
  RETURNING id INTO v_order_id;
  
  -- Insert items
  IF jsonb_array_length(p_items) > 0 THEN
    INSERT INTO order_items (
      order_id, product_id, product_name, variant_name, quantity, 
      price, total, scheme_discount, scheme_name, category_id, hsn_code
    )
    SELECT 
      v_order_id,
      (item->>'product_id')::uuid,
      item->>'product_name',
      item->>'variant_name',
      COALESCE((item->>'quantity')::int, 0),
      COALESCE((item->>'price')::numeric, 0),
      COALESCE((item->>'total')::numeric, 0),
      COALESCE((item->>'scheme_discount')::numeric, 0),
      item->>'scheme_name',
      NULLIF(item->>'category_id', '')::uuid,
      item->>'hsn_code'
    FROM jsonb_array_elements(p_items) AS item;
  END IF;
  
  RETURN jsonb_build_object('order_id', v_order_id, 'status', 'created', 'items_inserted', true);
  
EXCEPTION WHEN unique_violation THEN
  -- Handle race condition - order was inserted between our check and insert
  SELECT id INTO v_order_id FROM orders WHERE id = (p_order->>'id')::uuid;
  RETURN jsonb_build_object('order_id', COALESCE(v_order_id, gen_random_uuid()), 'status', 'conflict', 'items_inserted', false);
END;
$$;

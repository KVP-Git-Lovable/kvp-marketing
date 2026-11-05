CREATE OR REPLACE FUNCTION public.sync_order_with_items(p_order jsonb, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_existing_order_id uuid;
  v_items_count int := 0;
BEGIN
  v_order_id := public._safe_uuid(p_order->>'id');

  IF v_order_id IS NOT NULL THEN
    SELECT id INTO v_existing_order_id FROM orders WHERE id = v_order_id;
  END IF;

  IF v_existing_order_id IS NOT NULL THEN
    SELECT count(*) INTO v_items_count FROM order_items WHERE order_id = v_existing_order_id;

    IF v_items_count = 0 AND jsonb_array_length(p_items) > 0 THEN
      INSERT INTO order_items (
        order_id, product_id, variant_id, product_name, category, rate, unit, quantity, total,
        original_rate, discount_amount, hsn_code, sgst_amount, cgst_amount
      )
      SELECT
        v_existing_order_id,
        COALESCE(
          public._safe_uuid(item->>'product_id'),
          CASE
            WHEN COALESCE(item->>'id', '') LIKE '%_variant_%' THEN public._safe_uuid(split_part(item->>'id', '_variant_', 1))
            ELSE NULL
          END
        ) AS resolved_product_id,
        COALESCE(
          public._safe_uuid(item->>'variant_id'),
          CASE
            WHEN COALESCE(item->>'id', '') LIKE '%_variant_%' THEN public._safe_uuid(split_part(item->>'id', '_variant_', 2))
            ELSE NULL
          END,
          CASE
            WHEN public._safe_uuid(item->>'product_id') IS NOT NULL
              AND EXISTS (SELECT 1 FROM public.product_variants pv WHERE pv.id = public._safe_uuid(item->>'product_id'))
            THEN public._safe_uuid(item->>'product_id')
            ELSE NULL
          END
        ) AS resolved_variant_id,
        COALESCE(item->>'product_name', ''),
        COALESCE(item->>'category', 'Unknown'),
        COALESCE((item->>'rate')::numeric, (item->>'price')::numeric, 0),
        COALESCE(item->>'unit', 'piece'),
        COALESCE((item->>'quantity')::int, 0),
        COALESCE((item->>'total')::numeric, 0),
        NULLIF(item->>'original_rate','')::numeric,
        NULLIF(item->>'discount_amount','')::numeric,
        item->>'hsn_code',
        NULLIF(item->>'sgst_amount','')::numeric,
        NULLIF(item->>'cgst_amount','')::numeric
      FROM jsonb_array_elements(p_items) AS item;
    END IF;

    RETURN jsonb_build_object('order_id', v_existing_order_id, 'status', 'existing', 'items_inserted', v_items_count = 0);
  END IF;

  INSERT INTO orders (
    id, user_id, retailer_id, retailer_name, visit_id, beat_name,
    order_date, total_amount, total_qty, status, payment_method,
    is_credit_order, credit_pending_amount, credit_paid_amount,
    previous_pending_cleared, invoice_number, idempotency_key,
    sales_channel, event_id,
    created_at, updated_at
  ) VALUES (
    COALESCE(v_order_id, gen_random_uuid()),
    public._safe_uuid(p_order->>'user_id'),
    public._safe_uuid(p_order->>'retailer_id'),
    p_order->>'retailer_name',
    public._safe_uuid(p_order->>'visit_id'),
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
    COALESCE(NULLIF(p_order->>'sales_channel', ''), 'field'),
    public._safe_uuid(p_order->>'event_id'),
    COALESCE((p_order->>'created_at')::timestamptz, now()),
    now()
  )
  RETURNING id INTO v_order_id;

  IF jsonb_array_length(p_items) > 0 THEN
    INSERT INTO order_items (
      order_id, product_id, variant_id, product_name, category, rate, unit, quantity, total,
      original_rate, discount_amount, hsn_code, sgst_amount, cgst_amount
    )
    SELECT
      v_order_id,
      COALESCE(
        public._safe_uuid(item->>'product_id'),
        CASE
          WHEN COALESCE(item->>'id', '') LIKE '%_variant_%' THEN public._safe_uuid(split_part(item->>'id', '_variant_', 1))
          ELSE NULL
        END
      ) AS resolved_product_id,
      COALESCE(
        public._safe_uuid(item->>'variant_id'),
        CASE
          WHEN COALESCE(item->>'id', '') LIKE '%_variant_%' THEN public._safe_uuid(split_part(item->>'id', '_variant_', 2))
          ELSE NULL
        END,
        CASE
          WHEN public._safe_uuid(item->>'product_id') IS NOT NULL
            AND EXISTS (SELECT 1 FROM public.product_variants pv WHERE pv.id = public._safe_uuid(item->>'product_id'))
          THEN public._safe_uuid(item->>'product_id')
          ELSE NULL
        END
      ) AS resolved_variant_id,
      COALESCE(item->>'product_name', ''),
      COALESCE(item->>'category', 'Unknown'),
      COALESCE((item->>'rate')::numeric, (item->>'price')::numeric, 0),
      COALESCE(item->>'unit', 'piece'),
      COALESCE((item->>'quantity')::int, 0),
      COALESCE((item->>'total')::numeric, 0),
      NULLIF(item->>'original_rate','')::numeric,
      NULLIF(item->>'discount_amount','')::numeric,
      item->>'hsn_code',
      NULLIF(item->>'sgst_amount','')::numeric,
      NULLIF(item->>'cgst_amount','')::numeric
    FROM jsonb_array_elements(p_items) AS item;
  END IF;

  RETURN jsonb_build_object('order_id', v_order_id, 'status', 'created', 'items_inserted', true);

EXCEPTION WHEN unique_violation THEN
  SELECT id INTO v_order_id FROM orders WHERE id = public._safe_uuid(p_order->>'id');
  RETURN jsonb_build_object('order_id', COALESCE(v_order_id, gen_random_uuid()), 'status', 'conflict', 'items_inserted', false);
END;
$function$;
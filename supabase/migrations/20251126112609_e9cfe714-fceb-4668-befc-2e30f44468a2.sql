-- Fix orders without visit_id by creating visits and linking them
-- This handles offline orders that were synced without proper visit context

DO $$
DECLARE
  order_rec RECORD;
  visit_rec RECORD;
  new_visit_id UUID;
BEGIN
  -- Loop through all confirmed orders without visit_id
  FOR order_rec IN 
    SELECT 
      o.id as order_id,
      o.retailer_id,
      o.user_id,
      o.order_date,
      o.total_amount,
      o.created_at
    FROM orders o
    WHERE o.visit_id IS NULL
      AND o.status = 'confirmed'
      AND o.order_date >= CURRENT_DATE - INTERVAL '7 days'
    ORDER BY o.order_date DESC, o.created_at ASC
  LOOP
    -- Check if a visit already exists for this retailer on this date
    SELECT v.id INTO visit_rec
    FROM visits v
    WHERE v.retailer_id = order_rec.retailer_id
      AND v.user_id = order_rec.user_id
      AND v.planned_date = order_rec.order_date
    LIMIT 1;
    
    IF visit_rec.id IS NOT NULL THEN
      -- Visit exists, just link the order to it
      new_visit_id := visit_rec.id;
      
      RAISE NOTICE 'Linking order % to existing visit %', order_rec.order_id, new_visit_id;
    ELSE
      -- No visit exists, create one
      INSERT INTO visits (
        user_id,
        retailer_id,
        planned_date,
        status,
        check_in_time,
        check_out_time,
        skip_check_in_reason,
        skip_check_in_time,
        created_at,
        updated_at
      ) VALUES (
        order_rec.user_id,
        order_rec.retailer_id,
        order_rec.order_date,
        'productive',
        order_rec.created_at,
        order_rec.created_at,
        'offline-order',
        order_rec.created_at,
        order_rec.created_at,
        NOW()
      )
      RETURNING id INTO new_visit_id;
      
      RAISE NOTICE 'Created new visit % for order %', new_visit_id, order_rec.order_id;
    END IF;
    
    -- Link the order to the visit
    UPDATE orders
    SET visit_id = new_visit_id
    WHERE id = order_rec.order_id;
    
    -- Update visit status to productive if not already
    UPDATE visits
    SET 
      status = 'productive',
      check_out_time = COALESCE(check_out_time, order_rec.created_at),
      no_order_reason = NULL,
      updated_at = NOW()
    WHERE id = new_visit_id
      AND status != 'productive';
  END LOOP;
  
  RAISE NOTICE 'Fixed all orders without visit_id';
END $$;
-- Fix #1: Make auto_update_visit_status_on_order require at least one order_item
-- before flipping the visit to 'productive'. The atomic sync_order_with_items RPC
-- inserts items in the same transaction, so this EXISTS check sees them.

CREATE OR REPLACE FUNCTION public.auto_update_visit_status_on_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_visit_id UUID;
  has_items BOOLEAN;
BEGIN
  -- Only process confirmed orders
  IF NEW.status = 'confirmed' THEN
    -- Require at least one order item before marking visit productive.
    -- Empty orders must NOT mark the visit as successful.
    SELECT EXISTS (
      SELECT 1 FROM order_items WHERE order_id = NEW.id
    ) INTO has_items;

    IF NOT has_items THEN
      RAISE LOG 'auto_update_visit_status_on_order: skipping order % - no items yet', NEW.id;
      RETURN NEW;
    END IF;

    -- First try to use the provided visit_id
    target_visit_id := NEW.visit_id;

    -- If no visit_id provided, find the most recent visit for this retailer today
    IF target_visit_id IS NULL AND NEW.retailer_id IS NOT NULL AND NEW.user_id IS NOT NULL THEN
      SELECT id INTO target_visit_id
      FROM visits
      WHERE retailer_id = NEW.retailer_id
        AND user_id = NEW.user_id
        AND planned_date = NEW.order_date
        AND status IN ('planned', 'in-progress', 'unproductive')
      ORDER BY created_at DESC
      LIMIT 1;

      RAISE LOG 'auto_update_visit_status_on_order: order % has NULL visit_id, found visit %', NEW.id, target_visit_id;
    END IF;

    -- Update the visit if found
    IF target_visit_id IS NOT NULL THEN
      UPDATE visits
      SET 
        status = 'productive',
        check_out_time = COALESCE(check_out_time, NEW.created_at),
        no_order_reason = NULL,
        updated_at = NOW()
      WHERE id = target_visit_id
        AND status IN ('planned', 'in-progress', 'unproductive');

      RAISE LOG 'auto_update_visit_status_on_order: updated visit % to productive', target_visit_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;


-- Fix #2: Companion trigger on order_items AFTER INSERT.
-- When the first item arrives for a confirmed order whose visit isn't yet productive,
-- promote the visit to 'productive'. This catches any non-RPC two-step insert paths
-- safely (e.g. legacy direct inserts where header was created before items).

CREATE OR REPLACE FUNCTION public.auto_update_visit_status_on_order_items()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order RECORD;
  target_visit_id UUID;
BEGIN
  -- Look up the parent order
  SELECT id, status, visit_id, retailer_id, user_id, order_date, created_at
  INTO v_order
  FROM orders
  WHERE id = NEW.order_id;

  IF v_order.id IS NULL OR v_order.status <> 'confirmed' THEN
    RETURN NEW;
  END IF;

  -- Resolve target visit
  target_visit_id := v_order.visit_id;

  IF target_visit_id IS NULL AND v_order.retailer_id IS NOT NULL AND v_order.user_id IS NOT NULL THEN
    SELECT id INTO target_visit_id
    FROM visits
    WHERE retailer_id = v_order.retailer_id
      AND user_id = v_order.user_id
      AND planned_date = v_order.order_date
      AND status IN ('planned', 'in-progress', 'unproductive')
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF target_visit_id IS NOT NULL THEN
    UPDATE visits
    SET 
      status = 'productive',
      check_out_time = COALESCE(check_out_time, v_order.created_at),
      no_order_reason = NULL,
      updated_at = NOW()
    WHERE id = target_visit_id
      AND status IN ('planned', 'in-progress', 'unproductive');
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_update_visit_status_on_order_items ON public.order_items;
CREATE TRIGGER trg_auto_update_visit_status_on_order_items
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.auto_update_visit_status_on_order_items();


-- Fix #3: One-time visit-status backfill.
-- For every visit currently 'productive' whose only "productive" trigger was an
-- order with zero items AND where the user never checked in, revert that visit
-- to 'planned' and clear check_out_time + completion_source.
-- The orders themselves are NOT touched.

WITH bad_visits AS (
  SELECT DISTINCT v.id
  FROM visits v
  JOIN orders o ON o.visit_id = v.id
  WHERE v.status = 'productive'
    AND v.check_in_time IS NULL
    AND o.status = 'confirmed'
    AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)
    -- Make sure this visit has NO confirmed order with items
    AND NOT EXISTS (
      SELECT 1 FROM orders o2
      WHERE o2.visit_id = v.id
        AND o2.status = 'confirmed'
        AND EXISTS (SELECT 1 FROM order_items oi2 WHERE oi2.order_id = o2.id)
    )
)
UPDATE visits
SET 
  status = 'planned',
  check_out_time = NULL,
  completion_source = NULL,
  updated_at = NOW()
WHERE id IN (SELECT id FROM bad_visits);
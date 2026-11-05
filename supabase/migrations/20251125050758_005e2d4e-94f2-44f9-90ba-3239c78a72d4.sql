-- Fix existing visits with orders that have wrong status
UPDATE visits v
SET 
  status = 'productive',
  check_out_time = COALESCE(check_out_time, NOW()),
  updated_at = NOW()
FROM orders o
WHERE v.id = o.visit_id
  AND o.status = 'confirmed'
  AND v.status IN ('planned', 'cancelled', 'unproductive', 'in-progress')
  AND o.created_at >= CURRENT_DATE - INTERVAL '7 days';

-- Create a trigger function to auto-update visit status when order is created
CREATE OR REPLACE FUNCTION auto_update_visit_status_on_order()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- When an order is confirmed, update the visit status to productive
  IF NEW.status = 'confirmed' AND NEW.visit_id IS NOT NULL THEN
    UPDATE visits
    SET 
      status = 'productive',
      check_out_time = COALESCE(check_out_time, NEW.created_at),
      no_order_reason = NULL,
      updated_at = NOW()
    WHERE id = NEW.visit_id
      AND status IN ('planned', 'in-progress', 'unproductive');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists and recreate it
DROP TRIGGER IF EXISTS trigger_auto_update_visit_on_order ON orders;

CREATE TRIGGER trigger_auto_update_visit_on_order
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_visit_status_on_order();
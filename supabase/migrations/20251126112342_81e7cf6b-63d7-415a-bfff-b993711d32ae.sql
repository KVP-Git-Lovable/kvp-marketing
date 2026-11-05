-- Create trigger to automatically update visit status when order is inserted/updated
-- This ensures visits show as 'productive' when orders are synced from offline mode

DROP TRIGGER IF EXISTS trigger_auto_update_visit_status_on_order ON orders;

CREATE TRIGGER trigger_auto_update_visit_status_on_order
  AFTER INSERT OR UPDATE OF status
  ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_visit_status_on_order();

-- Fix any existing visits that have orders but wrong status
UPDATE visits v
SET 
  status = 'productive',
  check_out_time = COALESCE(v.check_out_time, NOW()),
  no_order_reason = NULL,
  updated_at = NOW()
WHERE v.status IN ('planned', 'cancelled', 'unproductive')
  AND EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.visit_id = v.id 
      AND o.status = 'confirmed'
  );
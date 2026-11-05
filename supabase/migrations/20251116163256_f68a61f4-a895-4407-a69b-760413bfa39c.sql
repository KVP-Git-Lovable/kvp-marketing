-- Add performance analytics fields to retailers table
ALTER TABLE retailers
ADD COLUMN IF NOT EXISTS last_order_date date,
ADD COLUMN IF NOT EXISTS last_order_value numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_monthly_orders_3m numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_order_per_visit_3m numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_visits_3m integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS productive_visits_3m integer DEFAULT 0;

-- Function to update retailer last order info
CREATE OR REPLACE FUNCTION update_retailer_last_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last order date and value when order is confirmed
  IF NEW.status = 'confirmed' THEN
    UPDATE retailers
    SET 
      last_order_date = NEW.order_date,
      last_order_value = NEW.total_amount,
      order_value = NEW.total_amount,
      updated_at = NOW()
    WHERE id = NEW.retailer_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for order updates
DROP TRIGGER IF EXISTS trigger_update_retailer_last_order ON orders;
CREATE TRIGGER trigger_update_retailer_last_order
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_retailer_last_order();

-- Function to update retailer performance analytics
CREATE OR REPLACE FUNCTION update_retailer_analytics()
RETURNS TRIGGER AS $$
DECLARE
  v_retailer_id uuid;
  v_three_months_ago date;
  v_total_orders numeric;
  v_total_visits integer;
  v_productive_visits integer;
BEGIN
  -- Determine retailer_id based on the trigger context
  IF TG_TABLE_NAME = 'orders' THEN
    v_retailer_id := NEW.retailer_id;
  ELSIF TG_TABLE_NAME = 'visits' THEN
    v_retailer_id := NEW.retailer_id;
  ELSE
    RETURN NEW;
  END IF;

  v_three_months_ago := CURRENT_DATE - INTERVAL '3 months';

  -- Calculate total confirmed orders in last 3 months
  SELECT COALESCE(COUNT(*), 0)
  INTO v_total_orders
  FROM orders
  WHERE retailer_id = v_retailer_id
    AND status = 'confirmed'
    AND order_date >= v_three_months_ago;

  -- Calculate total visits in last 3 months
  SELECT COALESCE(COUNT(*), 0)
  INTO v_total_visits
  FROM visits
  WHERE retailer_id = v_retailer_id
    AND planned_date >= v_three_months_ago;

  -- Calculate productive visits (visits with orders) in last 3 months
  SELECT COALESCE(COUNT(DISTINCT v.id), 0)
  INTO v_productive_visits
  FROM visits v
  WHERE v.retailer_id = v_retailer_id
    AND v.planned_date >= v_three_months_ago
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.visit_id = v.id
        AND o.status = 'confirmed'
    );

  -- Update retailer with calculated analytics
  UPDATE retailers
  SET
    avg_monthly_orders_3m = CASE WHEN v_total_orders > 0 THEN v_total_orders / 3.0 ELSE 0 END,
    avg_order_per_visit_3m = CASE WHEN v_total_visits > 0 THEN v_total_orders::numeric / v_total_visits ELSE 0 END,
    total_visits_3m = v_total_visits,
    productive_visits_3m = v_productive_visits,
    updated_at = NOW()
  WHERE id = v_retailer_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for orders - update analytics
DROP TRIGGER IF EXISTS trigger_update_retailer_analytics_orders ON orders;
CREATE TRIGGER trigger_update_retailer_analytics_orders
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_retailer_analytics();

-- Trigger for visits - update analytics
DROP TRIGGER IF EXISTS trigger_update_retailer_analytics_visits ON visits;
CREATE TRIGGER trigger_update_retailer_analytics_visits
  AFTER INSERT OR UPDATE ON visits
  FOR EACH ROW
  EXECUTE FUNCTION update_retailer_analytics();

-- Update last_visit_date when a visit is created
CREATE OR REPLACE FUNCTION update_retailer_last_visit()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE retailers
  SET 
    last_visit_date = NEW.planned_date,
    updated_at = NOW()
  WHERE id = NEW.retailer_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_retailer_last_visit ON visits;
CREATE TRIGGER trigger_update_retailer_last_visit
  AFTER INSERT OR UPDATE OF planned_date ON visits
  FOR EACH ROW
  EXECUTE FUNCTION update_retailer_last_visit();
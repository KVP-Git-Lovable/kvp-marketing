-- Add enhanced metadata fields to gamification_actions for the 9 metric types
-- This will support configuration for each metric type

-- Add columns to gamification_actions for metric-specific configurations
ALTER TABLE gamification_actions 
ADD COLUMN IF NOT EXISTS max_awardable_activities INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS base_daily_target NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS focused_products TEXT[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS max_daily_awards INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS consecutive_orders_required INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS min_growth_percentage NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS target_type TEXT DEFAULT 'orders'; -- 'orders' or 'sales_value'

-- Add a daily_awarded_count tracking table for metrics with daily limits
CREATE TABLE IF NOT EXISTS gamification_daily_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action_id UUID NOT NULL REFERENCES gamification_actions(id) ON DELETE CASCADE,
  tracking_date DATE NOT NULL,
  count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, action_id, tracking_date)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_daily_tracking_user_date ON gamification_daily_tracking(user_id, tracking_date);
CREATE INDEX IF NOT EXISTS idx_daily_tracking_action_date ON gamification_daily_tracking(action_id, tracking_date);

-- Add a retailer order sequence tracking table for frequency metrics
CREATE TABLE IF NOT EXISTS gamification_retailer_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  retailer_id UUID NOT NULL,
  consecutive_orders INTEGER DEFAULT 0,
  last_order_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, retailer_id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_retailer_sequences_user ON gamification_retailer_sequences(user_id);
CREATE INDEX IF NOT EXISTS idx_retailer_sequences_retailer ON gamification_retailer_sequences(retailer_id);

-- Update trigger for daily tracking
CREATE OR REPLACE FUNCTION update_gamification_daily_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_gamification_daily_tracking_timestamp
BEFORE UPDATE ON gamification_daily_tracking
FOR EACH ROW
EXECUTE FUNCTION update_gamification_daily_tracking_updated_at();

-- Update trigger for retailer sequences
CREATE TRIGGER update_gamification_retailer_sequences_timestamp
BEFORE UPDATE ON gamification_retailer_sequences
FOR EACH ROW
EXECUTE FUNCTION update_gamification_daily_tracking_updated_at();

COMMENT ON TABLE gamification_daily_tracking IS 'Tracks daily counts for metrics with daily award limits';
COMMENT ON TABLE gamification_retailer_sequences IS 'Tracks consecutive order sequences from retailers for frequency metrics';
COMMENT ON COLUMN gamification_actions.max_awardable_activities IS 'Maximum times this activity can be awarded (for first_order_new_retailer)';
COMMENT ON COLUMN gamification_actions.base_daily_target IS 'Daily target threshold (orders or sales value)';
COMMENT ON COLUMN gamification_actions.focused_products IS 'Array of product IDs or categories that count as focused products';
COMMENT ON COLUMN gamification_actions.max_daily_awards IS 'Maximum daily awards for this activity';
COMMENT ON COLUMN gamification_actions.consecutive_orders_required IS 'Number of consecutive orders required for frequency bonus';
COMMENT ON COLUMN gamification_actions.min_growth_percentage IS 'Minimum growth percentage required for beat growth metric';
COMMENT ON COLUMN gamification_actions.target_type IS 'Type of target: orders or sales_value';
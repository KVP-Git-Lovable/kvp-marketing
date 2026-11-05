-- Add RLS policies for the new gamification tracking tables

-- Enable RLS on the new tables
ALTER TABLE gamification_daily_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_retailer_sequences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for gamification_daily_tracking
CREATE POLICY "Users can view their own daily tracking"
  ON gamification_daily_tracking
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage daily tracking"
  ON gamification_daily_tracking
  FOR ALL
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for gamification_retailer_sequences
CREATE POLICY "Users can view their own retailer sequences"
  ON gamification_retailer_sequences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage retailer sequences"
  ON gamification_retailer_sequences
  FOR ALL
  USING (auth.uid() IS NOT NULL);
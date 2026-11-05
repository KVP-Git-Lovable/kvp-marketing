-- Create credit management configuration table
CREATE TABLE IF NOT EXISTS credit_management_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  scoring_mode TEXT NOT NULL DEFAULT 'manual' CHECK (scoring_mode IN ('manual', 'ai_driven')),
  lookback_period_months INTEGER NOT NULL DEFAULT 3,
  new_retailer_starting_score NUMERIC(3,1) NOT NULL DEFAULT 6.0 CHECK (new_retailer_starting_score >= 0 AND new_retailer_starting_score <= 10),
  payment_term_days INTEGER NOT NULL DEFAULT 30,
  credit_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.5,
  weight_growth_rate NUMERIC(3,1) NOT NULL DEFAULT 4.0 CHECK (weight_growth_rate >= 0 AND weight_growth_rate <= 10),
  weight_repayment_dso NUMERIC(3,1) NOT NULL DEFAULT 4.0 CHECK (weight_repayment_dso >= 0 AND weight_repayment_dso <= 10),
  weight_order_frequency NUMERIC(3,1) NOT NULL DEFAULT 2.0 CHECK (weight_order_frequency >= 0 AND weight_order_frequency <= 10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT total_weight_check CHECK (weight_growth_rate + weight_repayment_dso + weight_order_frequency = 10.0)
);

-- Create retailer credit scores table
CREATE TABLE IF NOT EXISTS retailer_credit_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id UUID NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  score NUMERIC(3,1) NOT NULL CHECK (score >= 0 AND score <= 10),
  credit_limit NUMERIC(12,2) NOT NULL DEFAULT 0,
  score_type TEXT NOT NULL DEFAULT 'ai_driven' CHECK (score_type IN ('manual', 'ai_driven')),
  growth_rate_score NUMERIC(3,1),
  repayment_dso_score NUMERIC(3,1),
  order_frequency_score NUMERIC(3,1),
  avg_growth_rate NUMERIC(10,2),
  avg_dso NUMERIC(10,2),
  avg_order_frequency NUMERIC(10,2),
  last_month_revenue NUMERIC(12,2),
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(retailer_id)
);

-- Add manual credit score field to retailers table
ALTER TABLE retailers 
ADD COLUMN IF NOT EXISTS manual_credit_score NUMERIC(3,1) CHECK (manual_credit_score >= 0 AND manual_credit_score <= 10);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_retailer_credit_scores_retailer_id ON retailer_credit_scores(retailer_id);
CREATE INDEX IF NOT EXISTS idx_retailer_credit_scores_score ON retailer_credit_scores(score);

-- Enable RLS
ALTER TABLE credit_management_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE retailer_credit_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies for credit_management_config
CREATE POLICY "Admins can manage credit config"
  ON credit_management_config
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view credit config"
  ON credit_management_config
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- RLS Policies for retailer_credit_scores
CREATE POLICY "Admins can manage all credit scores"
  ON retailer_credit_scores
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view credit scores for their retailers"
  ON retailer_credit_scores
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM retailers 
        WHERE retailers.id = retailer_credit_scores.retailer_id 
        AND retailers.user_id = auth.uid()
      )
      OR has_role(auth.uid(), 'admin')
    )
  );

-- Insert default configuration
INSERT INTO credit_management_config (
  is_enabled,
  scoring_mode,
  lookback_period_months,
  new_retailer_starting_score,
  payment_term_days,
  credit_multiplier,
  weight_growth_rate,
  weight_repayment_dso,
  weight_order_frequency
) VALUES (
  false,
  'manual',
  3,
  6.0,
  30,
  1.5,
  4.0,
  4.0,
  2.0
) ON CONFLICT DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_credit_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_credit_scores_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS update_credit_config_timestamp ON credit_management_config;
CREATE TRIGGER update_credit_config_timestamp
  BEFORE UPDATE ON credit_management_config
  FOR EACH ROW
  EXECUTE FUNCTION update_credit_config_updated_at();

DROP TRIGGER IF EXISTS update_credit_scores_timestamp ON retailer_credit_scores;
CREATE TRIGGER update_credit_scores_timestamp
  BEFORE UPDATE ON retailer_credit_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_credit_scores_updated_at();
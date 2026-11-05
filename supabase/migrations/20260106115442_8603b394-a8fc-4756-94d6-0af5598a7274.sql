-- =====================================================
-- AI SCHEME SUGGESTIONS TABLE
-- Stores AI-generated scheme recommendations pending approval
-- =====================================================

CREATE TABLE ai_scheme_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Suggested scheme details (mirrors product_schemes structure)
  suggested_name TEXT NOT NULL,
  suggested_description TEXT,
  suggested_scheme_type TEXT NOT NULL,
  suggested_discount_percentage NUMERIC DEFAULT 0,
  suggested_discount_amount NUMERIC DEFAULT 0,
  suggested_buy_quantity INTEGER DEFAULT 0,
  suggested_free_quantity INTEGER DEFAULT 0,
  suggested_condition_quantity INTEGER DEFAULT 0,
  suggested_min_order_value NUMERIC DEFAULT 0,
  suggested_tier_data JSONB DEFAULT '[]'::jsonb,
  suggested_start_date DATE,
  suggested_end_date DATE,
  suggested_product_id UUID,
  suggested_category_id UUID,
  
  -- AI analysis metadata
  analysis_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_ids UUID[] DEFAULT '{}',
  target_names TEXT[] DEFAULT '{}',
  
  -- AI reasoning
  reasoning TEXT NOT NULL,
  data_signals JSONB DEFAULT '{}'::jsonb,
  confidence_score NUMERIC(3,2) DEFAULT 0.75,
  expected_benefit TEXT,
  
  -- Status workflow
  status TEXT DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  admin_modifications JSONB,
  
  -- Created scheme reference
  created_scheme_id UUID REFERENCES product_schemes(id),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days')
);

-- Add indexes for efficient lookups
CREATE INDEX idx_ai_scheme_suggestions_status ON ai_scheme_suggestions(status);
CREATE INDEX idx_ai_scheme_suggestions_analysis_type ON ai_scheme_suggestions(analysis_type);
CREATE INDEX idx_ai_scheme_suggestions_created_at ON ai_scheme_suggestions(created_at DESC);

-- Enable RLS
ALTER TABLE ai_scheme_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS policies - Admin only access (using user_roles table)
CREATE POLICY "Admins can view all AI suggestions"
ON ai_scheme_suggestions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can insert AI suggestions"
ON ai_scheme_suggestions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can update AI suggestions"
ON ai_scheme_suggestions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete AI suggestions"
ON ai_scheme_suggestions FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- =====================================================
-- ALTER product_schemes to add source tracking
-- =====================================================

ALTER TABLE product_schemes 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS ai_suggestion_id UUID REFERENCES ai_scheme_suggestions(id);

COMMENT ON COLUMN product_schemes.source IS 'Source of scheme: manual or ai_suggested';
COMMENT ON COLUMN product_schemes.ai_suggestion_id IS 'Reference to the AI suggestion if this scheme was created from AI recommendation';
-- Create recommendations table to store AI-generated recommendations
CREATE TABLE IF NOT EXISTS public.recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendation_type TEXT NOT NULL CHECK (recommendation_type IN ('beat_visit', 'retailer_priority', 'discussion_points', 'beat_performance', 'optimal_day')),
  entity_id UUID, -- beat_id or retailer_id depending on type
  entity_name TEXT,
  recommendation_data JSONB NOT NULL, -- stores the actual recommendation details
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00
  reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- Create recommendation feedback table
CREATE TABLE IF NOT EXISTS public.recommendation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL REFERENCES public.recommendations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('like', 'dislike', 'implemented', 'ignored')),
  feedback_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(recommendation_id, user_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_recommendations_user_type ON public.recommendations(user_id, recommendation_type, is_active);
CREATE INDEX IF NOT EXISTS idx_recommendations_entity ON public.recommendations(entity_id, is_active);
CREATE INDEX IF NOT EXISTS idx_recommendations_created ON public.recommendations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_recommendation ON public.recommendation_feedback(recommendation_id);

-- Enable RLS
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recommendations
CREATE POLICY "Users can view their own recommendations"
  ON public.recommendations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recommendations"
  ON public.recommendations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recommendations"
  ON public.recommendations FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for feedback
CREATE POLICY "Users can view their own feedback"
  ON public.recommendation_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback"
  ON public.recommendation_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback"
  ON public.recommendation_feedback FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to clean up expired recommendations
CREATE OR REPLACE FUNCTION public.cleanup_expired_recommendations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.recommendations
  SET is_active = false
  WHERE expires_at < now() AND is_active = true;
END;
$$;
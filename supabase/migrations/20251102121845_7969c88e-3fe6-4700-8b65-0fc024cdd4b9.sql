-- Add feedback field to visits table
ALTER TABLE public.visits ADD COLUMN IF NOT EXISTS feedback JSONB;

-- Create visit_ai_insights table
CREATE TABLE IF NOT EXISTS public.visit_ai_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  retailer_id UUID REFERENCES public.retailers(id) ON DELETE CASCADE,
  insights JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create ai_feature_feedback table
CREATE TABLE IF NOT EXISTS public.ai_feature_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  retailer_id UUID REFERENCES public.retailers(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES public.visits(id) ON DELETE CASCADE,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('positive', 'negative')),
  feature TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policies for visit_ai_insights
ALTER TABLE public.visit_ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own AI insights"
  ON public.visit_ai_insights
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own AI insights"
  ON public.visit_ai_insights
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add RLS policies for ai_feature_feedback
ALTER TABLE public.ai_feature_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own feedback"
  ON public.ai_feature_feedback
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own feedback"
  ON public.ai_feature_feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_visit_ai_insights_user_retailer ON public.visit_ai_insights(user_id, retailer_id);
CREATE INDEX IF NOT EXISTS idx_ai_feature_feedback_user ON public.ai_feature_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_feature_feedback_feature ON public.ai_feature_feedback(feature);

-- Add trigger for updated_at on visit_ai_insights
CREATE OR REPLACE FUNCTION update_visit_ai_insights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_visit_ai_insights_updated_at_trigger
  BEFORE UPDATE ON public.visit_ai_insights
  FOR EACH ROW
  EXECUTE FUNCTION update_visit_ai_insights_updated_at();
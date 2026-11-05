
-- Add AI columns to existing tables
ALTER TABLE public.pm_risks ADD COLUMN IF NOT EXISTS ai_generated boolean DEFAULT false;

ALTER TABLE public.pm_support_requests ADD COLUMN IF NOT EXISTS ai_suggestion text;

ALTER TABLE public.pm_ideas ADD COLUMN IF NOT EXISTS ai_evaluation jsonb;

-- Create pm_ai_insights table for cached AI analysis
CREATE TABLE IF NOT EXISTS public.pm_ai_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  insight_type text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.pm_ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view AI insights" ON public.pm_ai_insights
  FOR SELECT USING (public.pm_is_project_member(project_id));

CREATE POLICY "Members can create AI insights" ON public.pm_ai_insights
  FOR INSERT WITH CHECK (public.pm_is_project_member(project_id));

CREATE POLICY "Members can delete AI insights" ON public.pm_ai_insights
  FOR DELETE USING (public.pm_is_project_member(project_id));

CREATE INDEX idx_pm_ai_insights_project ON public.pm_ai_insights(project_id, insight_type);

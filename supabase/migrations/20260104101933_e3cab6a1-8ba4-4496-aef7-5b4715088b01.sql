-- ===========================================
-- AI-Driven Sales Competency Module Schema
-- ===========================================

-- Role-based competency templates
CREATE TABLE public.competency_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_type TEXT NOT NULL CHECK (role_type IN ('field_executive', 'field_manager')),
  competency_name TEXT NOT NULL,
  competency_code TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('productivity', 'discipline', 'development', 'leadership', 'achievement')),
  weightage DECIMAL(5,2) NOT NULL CHECK (weightage >= 0 AND weightage <= 100),
  calculation_formula JSONB NOT NULL DEFAULT '{}'::jsonb,
  icon TEXT,
  max_score DECIMAL(5,2) DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Monthly competency scores per user
CREATE TABLE public.user_competency_monthly_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  competency_template_id UUID NOT NULL REFERENCES public.competency_templates(id) ON DELETE CASCADE,
  month_year DATE NOT NULL,
  score DECIMAL(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  raw_metrics JSONB DEFAULT '{}'::jsonb,
  previous_month_score DECIMAL(5,2),
  trend TEXT CHECK (trend IN ('improving', 'declining', 'stable', 'new')),
  calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, competency_template_id, month_year)
);

-- Monthly scorecard summary
CREATE TABLE public.user_monthly_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  month_year DATE NOT NULL,
  role_type TEXT NOT NULL CHECK (role_type IN ('field_executive', 'field_manager')),
  overall_score DECIMAL(5,2) NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  weighted_score DECIMAL(5,2),
  performance_band TEXT CHECK (performance_band IN ('exceptional', 'strong', 'developing', 'needs_improvement')),
  rank_in_team INTEGER,
  total_team_members INTEGER,
  ai_summary TEXT,
  ai_strengths JSONB DEFAULT '[]'::jsonb,
  ai_improvement_areas JSONB DEFAULT '[]'::jsonb,
  ai_action_plan JSONB DEFAULT '{}'::jsonb,
  manager_id UUID,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, month_year)
);

-- Manager notes and coaching records
CREATE TABLE public.competency_coaching_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scorecard_id UUID REFERENCES public.user_monthly_scorecards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  manager_id UUID NOT NULL,
  competency_template_id UUID REFERENCES public.competency_templates(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  action_items JSONB DEFAULT '[]'::jsonb,
  is_acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_user_competency_monthly_scores_user_month ON public.user_competency_monthly_scores(user_id, month_year);
CREATE INDEX idx_user_competency_monthly_scores_competency ON public.user_competency_monthly_scores(competency_template_id);
CREATE INDEX idx_user_monthly_scorecards_user_month ON public.user_monthly_scorecards(user_id, month_year);
CREATE INDEX idx_user_monthly_scorecards_manager ON public.user_monthly_scorecards(manager_id);
CREATE INDEX idx_competency_coaching_notes_scorecard ON public.competency_coaching_notes(scorecard_id);
CREATE INDEX idx_competency_coaching_notes_user ON public.competency_coaching_notes(user_id);
CREATE INDEX idx_competency_templates_role ON public.competency_templates(role_type, is_active);

-- Enable RLS
ALTER TABLE public.competency_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_competency_monthly_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_monthly_scorecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competency_coaching_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for competency_templates
CREATE POLICY "Anyone can view active competency templates"
ON public.competency_templates FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage competency templates"
ON public.competency_templates FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for user_competency_monthly_scores (self + managers via scorecard + admins)
CREATE POLICY "Users can view their own competency scores"
ON public.user_competency_monthly_scores FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Managers can view subordinate scores via scorecard"
ON public.user_competency_monthly_scores FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_monthly_scorecards sc
    WHERE sc.user_id = user_competency_monthly_scores.user_id
    AND sc.manager_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all competency scores"
ON public.user_competency_monthly_scores FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert competency scores"
ON public.user_competency_monthly_scores FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service can update competency scores"
ON public.user_competency_monthly_scores FOR UPDATE
USING (true);

-- RLS Policies for user_monthly_scorecards
CREATE POLICY "Users can view their own scorecards"
ON public.user_monthly_scorecards FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Managers can view subordinate scorecards"
ON public.user_monthly_scorecards FOR SELECT
USING (auth.uid() = manager_id);

CREATE POLICY "Admins can view all scorecards"
ON public.user_monthly_scorecards FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert scorecards"
ON public.user_monthly_scorecards FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service can update scorecards"
ON public.user_monthly_scorecards FOR UPDATE
USING (true);

-- RLS Policies for competency_coaching_notes
CREATE POLICY "Users can view coaching notes about them"
ON public.competency_coaching_notes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Managers can manage coaching notes they created"
ON public.competency_coaching_notes FOR ALL
USING (auth.uid() = manager_id);

CREATE POLICY "Admins can view all coaching notes"
ON public.competency_coaching_notes FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Update trigger for timestamps
CREATE TRIGGER update_competency_templates_updated_at
BEFORE UPDATE ON public.competency_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_monthly_scorecards_updated_at
BEFORE UPDATE ON public.user_monthly_scorecards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_competency_coaching_notes_updated_at
BEFORE UPDATE ON public.competency_coaching_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
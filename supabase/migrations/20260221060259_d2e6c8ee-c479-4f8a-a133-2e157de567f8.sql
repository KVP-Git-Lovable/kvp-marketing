
-- Project Resources table for team member allocation, rates, and deployment tracking
CREATE TABLE public.pm_project_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'developer',
  budget_allocated NUMERIC DEFAULT 0,
  selling_rate NUMERIC DEFAULT 0,
  cost_rate NUMERIC DEFAULT 0,
  start_date DATE,
  release_date DATE,
  deployment_type TEXT NOT NULL DEFAULT 'full_time' CHECK (deployment_type IN ('full_time', 'part_time')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Enable RLS
ALTER TABLE public.pm_project_resources ENABLE ROW LEVEL SECURITY;

-- RLS: project members can view resources
CREATE POLICY "Project members can view resources"
  ON public.pm_project_resources FOR SELECT
  USING (public.pm_is_project_member(project_id));

-- RLS: project members can insert resources
CREATE POLICY "Project members can insert resources"
  ON public.pm_project_resources FOR INSERT
  WITH CHECK (public.pm_is_project_member(project_id));

-- RLS: project members can update resources
CREATE POLICY "Project members can update resources"
  ON public.pm_project_resources FOR UPDATE
  USING (public.pm_is_project_member(project_id));

-- RLS: project members can delete resources
CREATE POLICY "Project members can delete resources"
  ON public.pm_project_resources FOR DELETE
  USING (public.pm_is_project_member(project_id));

-- Trigger for updated_at
CREATE TRIGGER update_pm_project_resources_updated_at
  BEFORE UPDATE ON public.pm_project_resources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- Create sections table for flexible board columns (like Asana sections)
CREATE TABLE public.pm_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#6B7280',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pm_sections ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view sections of their projects"
ON public.pm_sections FOR SELECT USING (true);

CREATE POLICY "Users can create sections"
ON public.pm_sections FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update sections"
ON public.pm_sections FOR UPDATE USING (true);

CREATE POLICY "Users can delete sections"
ON public.pm_sections FOR DELETE USING (true);

-- Add section_id to tasks
ALTER TABLE public.pm_tasks ADD COLUMN section_id UUID REFERENCES public.pm_sections(id) ON DELETE SET NULL;

-- Index for fast lookups
CREATE INDEX idx_pm_sections_project_id ON public.pm_sections(project_id);
CREATE INDEX idx_pm_tasks_section_id ON public.pm_tasks(section_id);

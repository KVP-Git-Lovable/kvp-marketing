
-- ═══ PROJECT TEMPLATES ═══════════════════════════════════════════════════════

CREATE TABLE public.pm_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view templates"
  ON public.pm_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create templates"
  ON public.pm_templates FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can update templates"
  ON public.pm_templates FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Creator can delete templates"
  ON public.pm_templates FOR DELETE
  USING (auth.uid() = created_by);

-- ═══ TEMPLATE SECTIONS ═══════════════════════════════════════════════════════

CREATE TABLE public.pm_template_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.pm_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_template_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View template sections"
  ON public.pm_template_sections FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Manage template sections"
  ON public.pm_template_sections FOR ALL
  USING (auth.uid() IS NOT NULL);

-- ═══ TEMPLATE TASKS ══════════════════════════════════════════════════════════

CREATE TABLE public.pm_template_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.pm_templates(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.pm_template_sections(id) ON DELETE SET NULL,
  parent_task_id UUID REFERENCES public.pm_template_tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'task',
  priority TEXT NOT NULL DEFAULT 'medium',
  duration_days INT NOT NULL DEFAULT 1,
  estimated_hours NUMERIC,
  sort_order INT NOT NULL DEFAULT 0,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_template_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View template tasks"
  ON public.pm_template_tasks FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Manage template tasks"
  ON public.pm_template_tasks FOR ALL
  USING (auth.uid() IS NOT NULL);

-- ═══ TEMPLATE DEPENDENCIES ══════════════════════════════════════════════════

CREATE TABLE public.pm_template_dependencies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.pm_templates(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.pm_template_tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES public.pm_template_tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'blocked_by',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_template_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View template dependencies"
  ON public.pm_template_dependencies FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Manage template dependencies"
  ON public.pm_template_dependencies FOR ALL
  USING (auth.uid() IS NOT NULL);

-- ═══ TEMPLATE ATTACHMENTS ═══════════════════════════════════════════════════

CREATE TABLE public.pm_template_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.pm_templates(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.pm_template_tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INT,
  file_type TEXT,
  note TEXT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_template_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View template attachments"
  ON public.pm_template_attachments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Manage template attachments"
  ON public.pm_template_attachments FOR ALL
  USING (auth.uid() IS NOT NULL);

-- ═══ Add template_id to projects for reference ═════════════════════════════
ALTER TABLE public.pm_projects ADD COLUMN IF NOT EXISTS source_template_id UUID REFERENCES public.pm_templates(id) ON DELETE SET NULL;

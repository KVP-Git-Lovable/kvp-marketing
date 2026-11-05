
-- Junction table for multiple collaborators per task
CREATE TABLE public.pm_task_collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);

-- Enable RLS
ALTER TABLE public.pm_task_collaborators ENABLE ROW LEVEL SECURITY;

-- Policies: project members can manage collaborators
CREATE POLICY "Project members can view task collaborators"
  ON public.pm_task_collaborators FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pm_tasks t WHERE t.id = task_id AND pm_is_project_member(t.project_id)
    )
  );

CREATE POLICY "Project members can add task collaborators"
  ON public.pm_task_collaborators FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pm_tasks t WHERE t.id = task_id AND pm_is_project_member(t.project_id)
    )
  );

CREATE POLICY "Project members can remove task collaborators"
  ON public.pm_task_collaborators FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM pm_tasks t WHERE t.id = task_id AND pm_is_project_member(t.project_id)
    )
  );

-- Migrate existing single collaborator_id data to the new table
INSERT INTO public.pm_task_collaborators (task_id, user_id)
SELECT id, collaborator_id FROM public.pm_tasks
WHERE collaborator_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Index for fast lookups
CREATE INDEX idx_pm_task_collaborators_task_id ON public.pm_task_collaborators(task_id);
CREATE INDEX idx_pm_task_collaborators_user_id ON public.pm_task_collaborators(user_id);

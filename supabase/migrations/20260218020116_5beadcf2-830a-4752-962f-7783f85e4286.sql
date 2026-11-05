
-- ============================================================
-- PROJECT MANAGEMENT SYSTEM - Complete Schema
-- ============================================================

-- Enums
CREATE TYPE public.pm_project_status AS ENUM ('planning', 'active', 'on_hold', 'completed', 'cancelled');
CREATE TYPE public.pm_task_status AS ENUM ('backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled');
CREATE TYPE public.pm_priority AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE public.pm_task_type AS ENUM ('epic', 'story', 'task', 'bug', 'idea', 'milestone');
CREATE TYPE public.pm_sprint_status AS ENUM ('planning', 'active', 'completed', 'cancelled');
CREATE TYPE public.pm_member_role AS ENUM ('owner', 'manager', 'developer', 'designer', 'tester', 'viewer');

-- ----------------------------------------------------------------
-- PROJECTS
-- ----------------------------------------------------------------
CREATE TABLE public.pm_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status public.pm_project_status NOT NULL DEFAULT 'planning',
  priority public.pm_priority NOT NULL DEFAULT 'medium',
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  estimated_hours NUMERIC(10,2),
  logged_hours NUMERIC(10,2) DEFAULT 0,
  budget NUMERIC(15,2),
  color TEXT DEFAULT '#6366f1',
  is_template BOOLEAN DEFAULT false,
  template_name TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_projects ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- PROJECT MEMBERS
-- ----------------------------------------------------------------
CREATE TABLE public.pm_project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.pm_member_role NOT NULL DEFAULT 'developer',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE public.pm_project_members ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- SPRINTS
-- ----------------------------------------------------------------
CREATE TABLE public.pm_sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal TEXT,
  status public.pm_sprint_status NOT NULL DEFAULT 'planning',
  start_date DATE,
  end_date DATE,
  velocity INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_sprints ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- MILESTONES
-- ----------------------------------------------------------------
CREATE TABLE public.pm_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  color TEXT DEFAULT '#f59e0b',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_milestones ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- TASKS
-- ----------------------------------------------------------------
CREATE TABLE public.pm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  sprint_id UUID REFERENCES public.pm_sprints(id) ON DELETE SET NULL,
  milestone_id UUID REFERENCES public.pm_milestones(id) ON DELETE SET NULL,
  parent_task_id UUID REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type public.pm_task_type NOT NULL DEFAULT 'task',
  status public.pm_task_status NOT NULL DEFAULT 'todo',
  priority public.pm_priority NOT NULL DEFAULT 'medium',
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  start_date DATE,
  due_date DATE,
  estimated_hours NUMERIC(8,2),
  logged_hours NUMERIC(8,2) DEFAULT 0,
  story_points INTEGER,
  sort_order INTEGER DEFAULT 0,
  tags TEXT[],
  is_blocked BOOLEAN DEFAULT false,
  block_reason TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_pm_tasks_project ON public.pm_tasks(project_id);
CREATE INDEX idx_pm_tasks_sprint ON public.pm_tasks(sprint_id);
CREATE INDEX idx_pm_tasks_parent ON public.pm_tasks(parent_task_id);
CREATE INDEX idx_pm_tasks_status ON public.pm_tasks(status);

-- ----------------------------------------------------------------
-- TASK DEPENDENCIES
-- ----------------------------------------------------------------
CREATE TABLE public.pm_task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  dependency_type TEXT DEFAULT 'finish_to_start',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(task_id, depends_on_task_id)
);

ALTER TABLE public.pm_task_dependencies ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- TIMESHEETS / TIME LOGS
-- ----------------------------------------------------------------
CREATE TABLE public.pm_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  hours NUMERIC(6,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_time_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_pm_time_logs_task ON public.pm_time_logs(task_id);
CREATE INDEX idx_pm_time_logs_user ON public.pm_time_logs(user_id);

-- ----------------------------------------------------------------
-- TASK COMMENTS
-- ----------------------------------------------------------------
CREATE TABLE public.pm_task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_task_comments ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- PROJECT RISKS
-- ----------------------------------------------------------------
CREATE TABLE public.pm_risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  probability TEXT DEFAULT 'medium', -- low, medium, high
  impact TEXT DEFAULT 'medium',      -- low, medium, high
  status TEXT DEFAULT 'open',         -- open, mitigated, closed
  mitigation_plan TEXT,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_risks ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- TASK TEMPLATES
-- ----------------------------------------------------------------
CREATE TABLE public.pm_task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_template_id UUID REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type public.pm_task_type NOT NULL DEFAULT 'task',
  priority public.pm_priority NOT NULL DEFAULT 'medium',
  estimated_hours NUMERIC(8,2),
  sort_order INTEGER DEFAULT 0,
  tags TEXT[],
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_task_templates ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- TRIGGERS for updated_at
-- ----------------------------------------------------------------
CREATE TRIGGER update_pm_projects_updated_at BEFORE UPDATE ON public.pm_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pm_sprints_updated_at BEFORE UPDATE ON public.pm_sprints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pm_milestones_updated_at BEFORE UPDATE ON public.pm_milestones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pm_tasks_updated_at BEFORE UPDATE ON public.pm_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pm_risks_updated_at BEFORE UPDATE ON public.pm_risks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pm_task_comments_updated_at BEFORE UPDATE ON public.pm_task_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------
-- TRIGGER: sync logged_hours on task when time log is inserted
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_task_logged_hours()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE pm_tasks SET logged_hours = (
    SELECT COALESCE(SUM(hours), 0) FROM pm_time_logs WHERE task_id = COALESCE(NEW.task_id, OLD.task_id)
  ) WHERE id = COALESCE(NEW.task_id, OLD.task_id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER sync_task_logged_hours_insert AFTER INSERT OR UPDATE OR DELETE ON public.pm_time_logs FOR EACH ROW EXECUTE FUNCTION public.sync_task_logged_hours();

-- ----------------------------------------------------------------
-- HELPER FUNCTION: is member of project
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pm_is_project_member(project_uuid UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM pm_project_members WHERE project_id = project_uuid AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM pm_projects WHERE id = project_uuid AND created_by = auth.uid()
  ) OR public.is_system_admin(auth.uid());
$$;

-- ----------------------------------------------------------------
-- RLS POLICIES
-- ----------------------------------------------------------------

-- pm_projects
CREATE POLICY "Members can view projects" ON public.pm_projects FOR SELECT USING (public.pm_is_project_member(id));
CREATE POLICY "Authenticated users can create projects" ON public.pm_projects FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Project owner/admin can update" ON public.pm_projects FOR UPDATE USING (auth.uid() = created_by OR public.is_system_admin(auth.uid()));
CREATE POLICY "Project owner/admin can delete" ON public.pm_projects FOR DELETE USING (auth.uid() = created_by OR public.is_system_admin(auth.uid()));

-- pm_project_members
CREATE POLICY "Members can view project members" ON public.pm_project_members FOR SELECT USING (public.pm_is_project_member(project_id));
CREATE POLICY "Project owner can manage members" ON public.pm_project_members FOR ALL USING (
  EXISTS (SELECT 1 FROM pm_projects WHERE id = project_id AND created_by = auth.uid()) OR public.is_system_admin(auth.uid())
);

-- pm_sprints
CREATE POLICY "Members can view sprints" ON public.pm_sprints FOR SELECT USING (public.pm_is_project_member(project_id));
CREATE POLICY "Members can manage sprints" ON public.pm_sprints FOR ALL USING (public.pm_is_project_member(project_id));

-- pm_milestones
CREATE POLICY "Members can view milestones" ON public.pm_milestones FOR SELECT USING (public.pm_is_project_member(project_id));
CREATE POLICY "Members can manage milestones" ON public.pm_milestones FOR ALL USING (public.pm_is_project_member(project_id));

-- pm_tasks
CREATE POLICY "Members can view tasks" ON public.pm_tasks FOR SELECT USING (public.pm_is_project_member(project_id));
CREATE POLICY "Members can create tasks" ON public.pm_tasks FOR INSERT WITH CHECK (public.pm_is_project_member(project_id) AND auth.uid() = created_by);
CREATE POLICY "Members can update tasks" ON public.pm_tasks FOR UPDATE USING (public.pm_is_project_member(project_id));
CREATE POLICY "Task creator/admin can delete" ON public.pm_tasks FOR DELETE USING (auth.uid() = created_by OR public.is_system_admin(auth.uid()));

-- pm_task_dependencies
CREATE POLICY "Members can view dependencies" ON public.pm_task_dependencies FOR SELECT USING (
  EXISTS (SELECT 1 FROM pm_tasks WHERE id = task_id AND public.pm_is_project_member(project_id))
);
CREATE POLICY "Members can manage dependencies" ON public.pm_task_dependencies FOR ALL USING (
  EXISTS (SELECT 1 FROM pm_tasks WHERE id = task_id AND public.pm_is_project_member(project_id))
);

-- pm_time_logs
CREATE POLICY "Users see own logs, project members see all" ON public.pm_time_logs FOR SELECT USING (user_id = auth.uid() OR public.pm_is_project_member(project_id));
CREATE POLICY "Users can log time" ON public.pm_time_logs FOR INSERT WITH CHECK (auth.uid() = user_id AND public.pm_is_project_member(project_id));
CREATE POLICY "Users can update own logs" ON public.pm_time_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own logs" ON public.pm_time_logs FOR DELETE USING (auth.uid() = user_id);

-- pm_task_comments
CREATE POLICY "Members can view comments" ON public.pm_task_comments FOR SELECT USING (
  EXISTS (SELECT 1 FROM pm_tasks WHERE id = task_id AND public.pm_is_project_member(project_id))
);
CREATE POLICY "Members can post comments" ON public.pm_task_comments FOR INSERT WITH CHECK (
  auth.uid() = user_id AND EXISTS (SELECT 1 FROM pm_tasks WHERE id = task_id AND public.pm_is_project_member(project_id))
);
CREATE POLICY "Users can edit own comments" ON public.pm_task_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.pm_task_comments FOR DELETE USING (auth.uid() = user_id);

-- pm_risks
CREATE POLICY "Members can view risks" ON public.pm_risks FOR SELECT USING (public.pm_is_project_member(project_id));
CREATE POLICY "Members can manage risks" ON public.pm_risks FOR ALL USING (public.pm_is_project_member(project_id));

-- pm_task_templates
CREATE POLICY "Authenticated can view templates" ON public.pm_task_templates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can create templates" ON public.pm_task_templates FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creator/admin can manage templates" ON public.pm_task_templates FOR ALL USING (auth.uid() = created_by OR public.is_system_admin(auth.uid()));

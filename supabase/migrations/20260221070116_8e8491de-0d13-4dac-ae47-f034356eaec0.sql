
-- Ideas table
CREATE TABLE public.pm_ideas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  submitted_by UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'implemented', 'rejected')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_ideas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view ideas" ON public.pm_ideas
  FOR SELECT USING (public.pm_is_project_member(project_id));

CREATE POLICY "Project members can insert ideas" ON public.pm_ideas
  FOR INSERT WITH CHECK (public.pm_is_project_member(project_id) AND auth.uid() = submitted_by);

CREATE POLICY "Idea author or admin can update" ON public.pm_ideas
  FOR UPDATE USING (auth.uid() = submitted_by OR public.is_system_admin(auth.uid()));

CREATE POLICY "Idea author or admin can delete" ON public.pm_ideas
  FOR DELETE USING (auth.uid() = submitted_by OR public.is_system_admin(auth.uid()));

-- Knowledge Documents table
CREATE TABLE public.pm_knowledge_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  file_name TEXT,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view docs" ON public.pm_knowledge_documents
  FOR SELECT USING (public.pm_is_project_member(project_id));

CREATE POLICY "Project members can insert docs" ON public.pm_knowledge_documents
  FOR INSERT WITH CHECK (public.pm_is_project_member(project_id) AND auth.uid() = uploaded_by);

CREATE POLICY "Doc uploader or admin can update" ON public.pm_knowledge_documents
  FOR UPDATE USING (auth.uid() = uploaded_by OR public.is_system_admin(auth.uid()));

CREATE POLICY "Doc uploader or admin can delete" ON public.pm_knowledge_documents
  FOR DELETE USING (auth.uid() = uploaded_by OR public.is_system_admin(auth.uid()));

-- Support Requests table
CREATE TABLE public.pm_support_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.pm_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  requested_by UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_support_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view support" ON public.pm_support_requests
  FOR SELECT USING (public.pm_is_project_member(project_id));

CREATE POLICY "Project members can insert support" ON public.pm_support_requests
  FOR INSERT WITH CHECK (public.pm_is_project_member(project_id) AND auth.uid() = requested_by);

CREATE POLICY "Requester or admin can update support" ON public.pm_support_requests
  FOR UPDATE USING (auth.uid() = requested_by OR public.is_system_admin(auth.uid()));

CREATE POLICY "Requester or admin can delete support" ON public.pm_support_requests
  FOR DELETE USING (auth.uid() = requested_by OR public.is_system_admin(auth.uid()));

-- Storage bucket for knowledge documents
INSERT INTO storage.buckets (id, name, public) VALUES ('pm-knowledge', 'pm-knowledge', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Project members can upload knowledge docs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'pm-knowledge' AND auth.uid() IS NOT NULL);

CREATE POLICY "Project members can view knowledge docs" ON storage.objects
  FOR SELECT USING (bucket_id = 'pm-knowledge' AND auth.uid() IS NOT NULL);

CREATE POLICY "Uploader can delete knowledge docs" ON storage.objects
  FOR DELETE USING (bucket_id = 'pm-knowledge' AND auth.uid()::text = (storage.foldername(name))[1]);

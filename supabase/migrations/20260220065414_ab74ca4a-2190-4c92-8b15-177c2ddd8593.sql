
-- Create pm_task_attachments table
CREATE TABLE public.pm_task_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.pm_tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  note TEXT,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pm_task_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Project members can view attachments"
  ON public.pm_task_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pm_tasks t
      WHERE t.id = pm_task_attachments.task_id
        AND public.pm_is_project_member(t.project_id)
    )
  );

CREATE POLICY "Project members can insert attachments"
  ON public.pm_task_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pm_tasks t
      WHERE t.id = pm_task_attachments.task_id
        AND public.pm_is_project_member(t.project_id)
    )
  );

CREATE POLICY "Project members can delete attachments"
  ON public.pm_task_attachments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.pm_tasks t
      WHERE t.id = pm_task_attachments.task_id
        AND public.pm_is_project_member(t.project_id)
    )
  );

-- Grant permissions
GRANT ALL ON public.pm_task_attachments TO authenticated;
GRANT ALL ON public.pm_task_attachments TO anon;

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('pm-attachments', 'pm-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload pm attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'pm-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view pm attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pm-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete pm attachments"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'pm-attachments' AND auth.uid() IS NOT NULL);

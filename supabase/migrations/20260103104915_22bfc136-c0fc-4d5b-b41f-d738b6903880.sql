-- Create distributor_evaluation_tasks table for detailed onboarding evaluation
CREATE TABLE public.distributor_evaluation_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  distributor_id UUID NOT NULL REFERENCES public.distributors(id) ON DELETE CASCADE,
  task_key TEXT NOT NULL,
  task_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  owner_user_id UUID,
  notes TEXT,
  attachment_urls TEXT[] DEFAULT '{}',
  due_date DATE,
  completed_date DATE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(distributor_id, task_key)
);

-- Enable RLS
ALTER TABLE public.distributor_evaluation_tasks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view evaluation tasks"
ON public.distributor_evaluation_tasks FOR SELECT
USING (true);

CREATE POLICY "Users can create evaluation tasks"
ON public.distributor_evaluation_tasks FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update evaluation tasks"
ON public.distributor_evaluation_tasks FOR UPDATE
USING (true);

CREATE POLICY "Users can delete evaluation tasks"
ON public.distributor_evaluation_tasks FOR DELETE
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_distributor_evaluation_tasks_updated_at
BEFORE UPDATE ON public.distributor_evaluation_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_distributor_evaluation_tasks_distributor_id ON public.distributor_evaluation_tasks(distributor_id);
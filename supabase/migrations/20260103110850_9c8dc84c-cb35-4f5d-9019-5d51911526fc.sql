-- Fix evaluation tasks RLS policies to use authenticated role
DROP POLICY IF EXISTS "Users can view evaluation tasks" ON public.distributor_evaluation_tasks;
DROP POLICY IF EXISTS "Users can create evaluation tasks" ON public.distributor_evaluation_tasks;
DROP POLICY IF EXISTS "Users can update evaluation tasks" ON public.distributor_evaluation_tasks;
DROP POLICY IF EXISTS "Users can delete evaluation tasks" ON public.distributor_evaluation_tasks;

CREATE POLICY "Authenticated users can view evaluation tasks"
ON public.distributor_evaluation_tasks
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert evaluation tasks"
ON public.distributor_evaluation_tasks
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update evaluation tasks"
ON public.distributor_evaluation_tasks
FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete evaluation tasks"
ON public.distributor_evaluation_tasks
FOR DELETE TO authenticated
USING (true);

-- Create storage bucket for distributor attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('distributor-attachments', 'distributor-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for the bucket
CREATE POLICY "Authenticated users can upload distributor attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'distributor-attachments');

CREATE POLICY "Authenticated users can update distributor attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'distributor-attachments');

CREATE POLICY "Anyone can view distributor attachments"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'distributor-attachments');

CREATE POLICY "Authenticated users can delete distributor attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'distributor-attachments');
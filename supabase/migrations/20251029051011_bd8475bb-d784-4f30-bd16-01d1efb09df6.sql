-- Create storage bucket for competition photos if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('competition-photos', 'competition-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for competition-photos bucket
CREATE POLICY "Users can upload their own competition photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'competition-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own competition photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'competition-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all competition photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'competition-photos' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'::public.app_role
  )
);
-- Ensure employee-photos storage bucket exists and proper policies allow upload and read

-- Create bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('employee-photos', 'employee-photos', true)
on conflict (id) do nothing;

-- Policies for storage.objects
DO $$
BEGIN
  -- Public read access for employee-photos bucket
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Employee photos are publicly accessible'
  ) THEN
    CREATE POLICY "Employee photos are publicly accessible"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'employee-photos');
  END IF;

  -- Users can upload their own employee photo to a folder with their user id prefix
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload their own employee photo'
  ) THEN
    CREATE POLICY "Users can upload their own employee photo"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
      bucket_id = 'employee-photos'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  -- Users can update their own employee photo
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update their own employee photo'
  ) THEN
    CREATE POLICY "Users can update their own employee photo"
    ON storage.objects
    FOR UPDATE
    USING (
      bucket_id = 'employee-photos'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END
$$;
-- Ensure public bucket for employee photos exists and is readable
insert into storage.buckets (id, name, public)
values ('employee-photos', 'employee-photos', true)
on conflict (id) do nothing;

-- Create policies safely if they don't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read for employee photos'
  ) THEN
    CREATE POLICY "Public read for employee photos"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'employee-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload their own employee photos'
  ) THEN
    CREATE POLICY "Users can upload their own employee photos"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
      bucket_id = 'employee-photos'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update their own employee photos'
  ) THEN
    CREATE POLICY "Users can update their own employee photos"
    ON storage.objects
    FOR UPDATE
    USING (
      bucket_id = 'employee-photos'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete their own employee photos'
  ) THEN
    CREATE POLICY "Users can delete their own employee photos"
    ON storage.objects
    FOR DELETE
    USING (
      bucket_id = 'employee-photos'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END
$$;
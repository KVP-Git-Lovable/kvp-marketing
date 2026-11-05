INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-bills', 'expense-bills', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for expense-bills bucket (skip if already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own expense bills' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can view their own expense bills" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'expense-bills' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can upload their own expense bills' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can upload their own expense bills" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'expense-bills' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own expense bills' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can update their own expense bills" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'expense-bills' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own expense bills' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can delete their own expense bills" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'expense-bills' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;
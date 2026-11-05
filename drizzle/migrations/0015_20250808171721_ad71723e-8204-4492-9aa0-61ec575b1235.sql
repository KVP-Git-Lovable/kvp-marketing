-- Add latitude and longitude to retailers
ALTER TABLE public.retailers
ADD COLUMN IF NOT EXISTS latitude numeric(9,6),
ADD COLUMN IF NOT EXISTS longitude numeric(9,6);

-- Create visits table for per-retailer check-in/out
CREATE TABLE IF NOT EXISTS public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  retailer_id uuid NOT NULL,
  planned_date date NOT NULL,
  status text NOT NULL DEFAULT 'planned',
  check_in_time timestamptz,
  check_in_location jsonb,
  check_in_photo_url text,
  location_match_in boolean,
  check_out_time timestamptz,
  check_out_location jsonb,
  check_out_photo_url text,
  location_match_out boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

-- Policies for visits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'visits' AND policyname = 'Users can view their own visits'
  ) THEN
    CREATE POLICY "Users can view their own visits"
    ON public.visits
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'visits' AND policyname = 'Users can create their own visits'
  ) THEN
    CREATE POLICY "Users can create their own visits"
    ON public.visits
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'visits' AND policyname = 'Users can update their own visits'
  ) THEN
    CREATE POLICY "Users can update their own visits"
    ON public.visits
    FOR UPDATE
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Trigger to auto-update updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_visits_updated_at'
  ) THEN
    CREATE TRIGGER update_visits_updated_at
    BEFORE UPDATE ON public.visits
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Create storage bucket for visit photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('visit-photos', 'visit-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Policies for visit-photos bucket
DO $$
BEGIN
  -- SELECT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can view their own visit photos'
  ) THEN
    CREATE POLICY "Users can view their own visit photos"
    ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'visit-photos' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  -- INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload their own visit photos'
  ) THEN
    CREATE POLICY "Users can upload their own visit photos"
    ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'visit-photos' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  -- UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update their own visit photos'
  ) THEN
    CREATE POLICY "Users can update their own visit photos"
    ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'visit-photos' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  -- DELETE (optional)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete their own visit photos'
  ) THEN
    CREATE POLICY "Users can delete their own visit photos"
    ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'visit-photos' AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;
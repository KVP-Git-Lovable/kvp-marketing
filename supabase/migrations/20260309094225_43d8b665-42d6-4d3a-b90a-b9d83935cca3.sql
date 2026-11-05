
CREATE TABLE public.geocoding_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'processing',
  total_records integer NOT NULL DEFAULT 0,
  processed_records integer NOT NULL DEFAULT 0,
  geocoded_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.geocoding_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read geocoding jobs"
  ON public.geocoding_jobs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert geocoding jobs"
  ON public.geocoding_jobs FOR INSERT
  TO authenticated
  WITH CHECK (true);

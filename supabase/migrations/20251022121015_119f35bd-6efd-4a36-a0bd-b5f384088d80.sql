-- Add gst_number column to retailers table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'retailers' 
    AND column_name = 'gst_number'
  ) THEN
    ALTER TABLE public.retailers ADD COLUMN gst_number TEXT;
  END IF;
END $$;
-- Create the visits storage bucket for voice notes and photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'visits', 
  'visits', 
  true, 
  52428800, -- 50MB limit
  ARRAY['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files to the visits bucket
CREATE POLICY "Authenticated users can upload to visits bucket"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'visits');

-- Allow authenticated users to read files from the visits bucket
CREATE POLICY "Anyone can read from visits bucket"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'visits');

-- Allow authenticated users to update their own files
CREATE POLICY "Authenticated users can update visits files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'visits');

-- Allow authenticated users to delete files from visits bucket
CREATE POLICY "Authenticated users can delete visits files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'visits');
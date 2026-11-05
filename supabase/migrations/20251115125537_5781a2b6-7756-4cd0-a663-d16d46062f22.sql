-- Make competition-photos bucket public so users can view photos and audio files
UPDATE storage.buckets 
SET public = true 
WHERE name = 'competition-photos';

-- Create RLS policies for competition-photos bucket
-- Allow anyone to view/download files (since bucket is public)
CREATE POLICY "Allow public read access to competition photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'competition-photos');

-- Allow authenticated users to upload their own files
CREATE POLICY "Allow authenticated users to upload competition photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'competition-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own files
CREATE POLICY "Allow users to update their own competition photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'competition-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own files
CREATE POLICY "Allow users to delete their own competition photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'competition-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
-- Fix competition-photos storage bucket policies
-- First, drop existing policies if any
DROP POLICY IF EXISTS "Competition photos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload competition photos" ON storage.objects;

-- Create policy for public read access to competition photos
CREATE POLICY "Public can view competition photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'competition-photos');

-- Create policy for authenticated users to upload competition photos
CREATE POLICY "Authenticated users can upload competition photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'competition-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Create policy for authenticated users to update their own competition photos
CREATE POLICY "Users can update their own competition photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'competition-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Create policy for authenticated users to delete their own competition photos
CREATE POLICY "Users can delete their own competition photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'competition-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
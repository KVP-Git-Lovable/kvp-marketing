-- Ensure invoices bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('invoices', 'invoices', true, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view invoices" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload invoices" ON storage.objects;
DROP POLICY IF EXISTS "Public can view invoices" ON storage.objects;

-- Create policy for public read access to ALL invoices
CREATE POLICY "Public can view invoices"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'invoices');

-- Create policy for authenticated users to upload invoices
CREATE POLICY "Authenticated users can upload invoices"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'invoices');
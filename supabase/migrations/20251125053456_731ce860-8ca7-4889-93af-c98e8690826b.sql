-- Clean up ALL invoices storage policies and create fresh ones

-- Drop all existing policies for invoices bucket
DROP POLICY IF EXISTS "Authenticated users can upload invoices" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload invoice PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can view invoice PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Users can update invoice PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Public can view invoices" ON storage.objects;

-- Create simple, clean policies for invoices bucket
-- Allow any authenticated user to upload invoices
CREATE POLICY "Allow authenticated invoice upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'invoices');

-- Allow any authenticated user to read invoices
CREATE POLICY "Allow authenticated invoice read"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'invoices');

-- Allow any authenticated user to update invoices
CREATE POLICY "Allow authenticated invoice update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'invoices')
WITH CHECK (bucket_id = 'invoices');
-- Fix RLS policies for invoices storage bucket to allow users to upload invoice PDFs

-- Drop existing policies on invoices bucket
DROP POLICY IF EXISTS "Allow authenticated users to upload invoices" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to upload their invoices" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to invoices" ON storage.objects;

-- Create policy to allow authenticated users to upload invoices
CREATE POLICY "Users can upload invoice PDFs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'invoices'
  AND auth.uid() IS NOT NULL
);

-- Create policy to allow users to read all invoices
CREATE POLICY "Users can view invoice PDFs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'invoices'
  AND auth.uid() IS NOT NULL
);

-- Create policy to allow users to update their own invoices
CREATE POLICY "Users can update invoice PDFs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'invoices'
  AND auth.uid() IS NOT NULL
)
WITH CHECK (
  bucket_id = 'invoices'
  AND auth.uid() IS NOT NULL
);
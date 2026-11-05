
-- Create a public bucket for invoice PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload invoice PDFs
CREATE POLICY "Authenticated users can upload invoices"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'invoices');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update invoices"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'invoices');

-- Allow public read access to invoice PDFs
CREATE POLICY "Public read access for invoices"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'invoices');

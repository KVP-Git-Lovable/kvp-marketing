-- Create storage bucket for invoices
INSERT INTO storage.buckets (id, name, public) 
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy for authenticated users to upload invoices
CREATE POLICY "Authenticated users can upload invoices"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create storage policy for public access to invoices
CREATE POLICY "Anyone can view invoices"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'invoices');
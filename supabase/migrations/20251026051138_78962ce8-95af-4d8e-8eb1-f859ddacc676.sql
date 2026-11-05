-- Add new columns to branding_requests table
ALTER TABLE public.branding_requests 
ADD COLUMN IF NOT EXISTS contract_document_url text,
ADD COLUMN IF NOT EXISTS implementation_photo_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS measurement_photo_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS retailer_feedback_on_branding text,
ADD COLUMN IF NOT EXISTS order_impact_notes text,
ADD COLUMN IF NOT EXISTS vendor_due_date date,
ADD COLUMN IF NOT EXISTS vendor_budget numeric,
ADD COLUMN IF NOT EXISTS vendor_confirmation_status text,
ADD COLUMN IF NOT EXISTS vendor_rating numeric CHECK (vendor_rating >= 1 AND vendor_rating <= 5),
ADD COLUMN IF NOT EXISTS vendor_feedback text,
ADD COLUMN IF NOT EXISTS implementation_date date,
ADD COLUMN IF NOT EXISTS post_implementation_notes text;

-- Create storage bucket for branding documents if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding-documents', 'branding-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload their own branding documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own branding documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own branding documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own branding documents" ON storage.objects;

-- Storage policies for branding documents
CREATE POLICY "Users can upload their own branding documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'branding-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own branding documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'branding-documents' AND
  (
    auth.uid()::text = (storage.foldername(name))[1] OR
    has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Users can update their own branding documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'branding-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own branding documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'branding-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
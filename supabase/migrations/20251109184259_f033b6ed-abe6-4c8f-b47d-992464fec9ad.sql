-- Create storage bucket for company assets (logos, documents)
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-assets', 'company-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for company assets
CREATE POLICY "Anyone can view company assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-assets');

CREATE POLICY "Admins can upload company assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'company-assets' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update company assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'company-assets' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete company assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'company-assets' 
  AND has_role(auth.uid(), 'admin'::app_role)
);
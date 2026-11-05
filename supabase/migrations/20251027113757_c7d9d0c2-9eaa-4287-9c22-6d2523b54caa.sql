-- Create product-photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-photos', 'product-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for product-photos bucket
CREATE POLICY "Admins can upload product photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-photos' 
  AND (SELECT has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Admins can update product photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-photos' 
  AND (SELECT has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Admins can delete product photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-photos' 
  AND (SELECT has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Product photos are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'product-photos');
-- Create storage bucket for retailer photos
INSERT INTO storage.buckets (id, name, public) VALUES ('retailer-photos', 'retailer-photos', false);

-- Create storage policies for retailer photos
CREATE POLICY "Users can upload their own retailer photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'retailer-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own retailer photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'retailer-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own retailer photos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'retailer-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own retailer photos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'retailer-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add photo_url column to retailers table
ALTER TABLE public.retailers ADD COLUMN photo_url text;
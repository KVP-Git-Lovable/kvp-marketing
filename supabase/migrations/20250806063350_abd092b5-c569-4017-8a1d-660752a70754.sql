-- Create storage bucket for attendance photos
INSERT INTO storage.buckets (id, name, public) VALUES ('attendance-photos', 'attendance-photos', false);

-- Create policies for attendance photos storage
CREATE POLICY "Users can upload their own attendance photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'attendance-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own attendance photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'attendance-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own attendance photos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'attendance-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
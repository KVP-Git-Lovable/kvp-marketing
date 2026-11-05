CREATE POLICY "Authenticated users can update pm attachments"
ON storage.objects FOR UPDATE
USING (bucket_id = 'pm-attachments' AND auth.uid() IS NOT NULL)
WITH CHECK (bucket_id = 'pm-attachments' AND auth.uid() IS NOT NULL);
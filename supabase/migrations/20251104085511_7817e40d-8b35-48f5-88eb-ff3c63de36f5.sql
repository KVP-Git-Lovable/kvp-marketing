-- Make employee-photos bucket public so profile pictures can be displayed
UPDATE storage.buckets 
SET public = true 
WHERE name = 'employee-photos';
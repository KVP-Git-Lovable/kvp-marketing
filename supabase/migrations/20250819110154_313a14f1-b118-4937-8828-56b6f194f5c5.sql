-- Create storage bucket for expense bills
insert into storage.buckets (id, name, public) values ('expense-bills', 'expense-bills', false);

-- Allow users to view their own files in the expense-bills bucket
create policy "Users can view their own expense bills" on storage.objects
for select to authenticated
using (
  bucket_id = 'expense-bills' and
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to upload their own files to the expense-bills bucket
create policy "Users can upload their own expense bills" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'expense-bills' and
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own files in the expense-bills bucket
create policy "Users can update their own expense bills" on storage.objects
for update to authenticated
using (
  bucket_id = 'expense-bills' and
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own files in the expense-bills bucket
create policy "Users can delete their own expense bills" on storage.objects
for delete to authenticated
using (
  bucket_id = 'expense-bills' and
  auth.uid()::text = (storage.foldername(name))[1]
);

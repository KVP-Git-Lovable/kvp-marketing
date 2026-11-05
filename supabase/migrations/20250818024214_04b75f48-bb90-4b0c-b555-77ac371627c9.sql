-- 1) Enum for employee document types
DO $$ BEGIN
  CREATE TYPE public.employee_doc_type AS ENUM ('address_proof', 'id_proof', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Employees table
CREATE TABLE IF NOT EXISTS public.employees (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_salary numeric NOT NULL DEFAULT 0,
  daily_da_allowance numeric NOT NULL DEFAULT 0,
  manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  hq text,
  date_of_joining date,
  date_of_exit date,
  alternate_email text,
  address text,
  education text,
  emergency_contact_number text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS and policies
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins can manage employees"
  ON public.employees
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view their own employee record"
  ON public.employees
  FOR SELECT
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger for updated_at
DO $$ BEGIN
  CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Employee documents table
CREATE TABLE IF NOT EXISTS public.employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_type public.employee_doc_type NOT NULL,
  file_path text NOT NULL,
  file_name text,
  content_type text,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins can manage employee documents"
  ON public.employee_documents
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view their own employee documents"
  ON public.employee_documents
  FOR SELECT
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) Storage buckets for employee photos and documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-photos', 'employee-photos', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-docs', 'employee-docs', false)
ON CONFLICT (id) DO NOTHING;

-- 5) Storage policies (admins full access; users can read their own files)
DO $$ BEGIN
  CREATE POLICY "Admins can read employee photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'employee-photos' AND has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can read employee docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'employee-docs' AND has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can upload employee photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'employee-photos' AND has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can upload employee docs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'employee-docs' AND has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can update employee photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'employee-photos' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'employee-photos' AND has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can update employee docs"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'employee-docs' AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'employee-docs' AND has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can delete employee photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'employee-photos' AND has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can delete employee docs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'employee-docs' AND has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Users can read their own files if uploaded under a folder named with their user_id
DO $$ BEGIN
  CREATE POLICY "Users can read their own employee photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'employee-photos' AND (auth.uid()::text = (storage.foldername(name))[1]));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can read their own employee docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'employee-docs' AND (auth.uid()::text = (storage.foldername(name))[1]));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
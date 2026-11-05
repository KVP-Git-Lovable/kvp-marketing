-- Create custom invoice templates table
CREATE TABLE IF NOT EXISTS public.custom_invoice_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  template_file_url text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true
);

-- Enable RLS
ALTER TABLE public.custom_invoice_templates ENABLE ROW LEVEL SECURITY;

-- Admin can manage custom templates
CREATE POLICY "Admins can manage custom templates"
ON public.custom_invoice_templates
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Users can view active templates
CREATE POLICY "Users can view active templates"
ON public.custom_invoice_templates
FOR SELECT
USING (is_active = true AND auth.uid() IS NOT NULL);

-- Create storage bucket for invoice templates
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-templates', 'invoice-templates', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for invoice templates
CREATE POLICY "Admins can upload invoice templates"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'invoice-templates' AND
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Anyone can view invoice templates"
ON storage.objects
FOR SELECT
USING (bucket_id = 'invoice-templates');

CREATE POLICY "Admins can delete invoice templates"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'invoice-templates' AND
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);
-- Create invoice_document_settings table for controlling document header source
CREATE TABLE public.invoice_document_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.invoice_document_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for read access (all authenticated users can read settings)
CREATE POLICY "Anyone can read invoice document settings" 
ON public.invoice_document_settings 
FOR SELECT 
USING (true);

-- Create policy for admin write access using user_roles table
CREATE POLICY "Admins can manage invoice document settings" 
ON public.invoice_document_settings 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Insert default settings
INSERT INTO invoice_document_settings (setting_key, setting_value) VALUES
('document_header_source', '{"invoices": "company", "delivery_challans": "company", "summaries": "company", "reports": "company"}'::jsonb),
('distributor_details_enabled', '{"enabled": false}'::jsonb);

-- Add bank/document detail columns to retailers table for distributors
ALTER TABLE public.retailers 
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_account TEXT,
ADD COLUMN IF NOT EXISTS ifsc TEXT,
ADD COLUMN IF NOT EXISTS account_holder_name TEXT,
ADD COLUMN IF NOT EXISTS qr_upi TEXT,
ADD COLUMN IF NOT EXISTS terms_conditions TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_invoice_document_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_invoice_document_settings_updated_at
BEFORE UPDATE ON public.invoice_document_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_invoice_document_settings_updated_at();
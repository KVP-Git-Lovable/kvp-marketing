-- Create invoice_display_settings table for centralized invoice control
CREATE TABLE public.invoice_display_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  setting_category TEXT NOT NULL,
  display_label TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoice_display_settings ENABLE ROW LEVEL SECURITY;

-- Create policies - all authenticated users can view, only admins can modify
CREATE POLICY "Anyone can view invoice display settings" 
ON public.invoice_display_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can update invoice display settings" 
ON public.invoice_display_settings 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can insert invoice display settings" 
ON public.invoice_display_settings 
FOR INSERT 
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_invoice_display_settings_updated_at
BEFORE UPDATE ON public.invoice_display_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings

-- Header Section
INSERT INTO public.invoice_display_settings (setting_key, enabled, setting_category, display_label, sort_order) VALUES
('header_company_logo', true, 'header', 'Company Logo', 1),
('header_company_name', true, 'header', 'Company Name', 2),
('header_company_address', true, 'header', 'Company Address', 3),
('header_company_phone', true, 'header', 'Company Phone', 4),
('header_company_email', true, 'header', 'Company Email', 5),
('header_company_gstin', true, 'header', 'Company GSTIN', 6),
('header_company_state', true, 'header', 'Company State', 7);

-- Bill To Section
INSERT INTO public.invoice_display_settings (setting_key, enabled, setting_category, display_label, sort_order) VALUES
('billto_retailer_name', true, 'billto', 'Retailer Name', 1),
('billto_retailer_address', true, 'billto', 'Retailer Address', 2),
('billto_retailer_phone', true, 'billto', 'Retailer Phone', 3),
('billto_retailer_gstin', true, 'billto', 'Retailer GSTIN', 4),
('billto_retailer_state', true, 'billto', 'Retailer State', 5);

-- Invoice Details Section
INSERT INTO public.invoice_display_settings (setting_key, enabled, setting_category, display_label, sort_order) VALUES
('details_invoice_number', true, 'details', 'Invoice Number', 1),
('details_invoice_date', true, 'details', 'Invoice Date', 2),
('details_invoice_time', false, 'details', 'Invoice Time', 3),
('details_beat_name', true, 'details', 'Route/Beat Name', 4),
('details_salesman_name', true, 'details', 'Salesman Name', 5);

-- Items Table Columns
INSERT INTO public.invoice_display_settings (setting_key, enabled, setting_category, display_label, sort_order) VALUES
('table_hsn_code', true, 'table', 'HSN/SAC Code', 1),
('table_unit_column', true, 'table', 'Unit Column', 2),
('table_discount_column', true, 'table', 'Discount/Offer Column', 3),
('table_gst_column', true, 'table', 'GST % Column', 4);

-- Totals Section
INSERT INTO public.invoice_display_settings (setting_key, enabled, setting_category, display_label, sort_order) VALUES
('totals_subtotal', true, 'totals', 'Subtotal', 1),
('totals_tax_breakdown', true, 'totals', 'Tax Breakdown (CGST/SGST)', 2),
('totals_discount_line', true, 'totals', 'Discount Line', 3),
('totals_amount_words', true, 'totals', 'Amount in Words', 4);

-- Payment Section
INSERT INTO public.invoice_display_settings (setting_key, enabled, setting_category, display_label, sort_order) VALUES
('payment_bank_details', true, 'payment', 'Bank Details', 1),
('payment_qr_code', true, 'payment', 'QR Code for Payment', 2),
('payment_upi_id', true, 'payment', 'UPI ID', 3);

-- Footer Section
INSERT INTO public.invoice_display_settings (setting_key, enabled, setting_category, display_label, sort_order) VALUES
('footer_signature_area', true, 'footer', 'Signature Area', 1),
('footer_terms_conditions', true, 'footer', 'Terms & Conditions', 2),
('footer_thank_you', true, 'footer', 'Thank You Message', 3);
-- Add invoice_template field to companies table
ALTER TABLE companies 
ADD COLUMN invoice_template text DEFAULT 'template1';

COMMENT ON COLUMN companies.invoice_template IS 'Selected invoice template design (template1, template2, template3)';
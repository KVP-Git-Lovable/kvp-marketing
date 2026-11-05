
-- Create credit_notes table
CREATE TABLE IF NOT EXISTS public.credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number text NOT NULL UNIQUE,
  credit_note_date date NOT NULL DEFAULT CURRENT_DATE,
  retailer_id uuid,
  retailer_name text,
  reason text,
  reason_notes text,
  sub_total numeric DEFAULT 0,
  sgst_total numeric DEFAULT 0,
  cgst_total numeric DEFAULT 0,
  total_amount numeric DEFAULT 0,
  amount_in_words text,
  status text DEFAULT 'issued',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create credit_note_items table
CREATE TABLE IF NOT EXISTS public.credit_note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id uuid REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  original_order_id uuid,
  original_invoice_number text,
  product_id uuid,
  product_name text,
  hsn_code text,
  unit text,
  quantity numeric DEFAULT 0,
  rate numeric DEFAULT 0,
  total numeric DEFAULT 0,
  taxable_amount numeric DEFAULT 0,
  sgst_amount numeric DEFAULT 0,
  cgst_amount numeric DEFAULT 0,
  barcode text,
  created_at timestamptz DEFAULT now()
);

-- Create sequence for credit note numbering
CREATE SEQUENCE IF NOT EXISTS public.credit_note_number_seq START 1;

-- Enable RLS
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for credit_notes
CREATE POLICY "Authenticated users can select credit_notes" ON public.credit_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert credit_notes" ON public.credit_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update credit_notes" ON public.credit_notes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- RLS policies for credit_note_items
CREATE POLICY "Authenticated users can select credit_note_items" ON public.credit_note_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert credit_note_items" ON public.credit_note_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update credit_note_items" ON public.credit_note_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

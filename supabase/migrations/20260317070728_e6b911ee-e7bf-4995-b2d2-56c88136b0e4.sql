
-- Credit Notes table
CREATE TABLE public.credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number TEXT NOT NULL,
  credit_note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  retailer_id UUID REFERENCES public.retailers(id),
  retailer_name TEXT,
  reason TEXT NOT NULL DEFAULT 'other',
  reason_notes TEXT,
  sub_total NUMERIC(12,2) DEFAULT 0,
  sgst_total NUMERIC(12,2) DEFAULT 0,
  cgst_total NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  amount_in_words TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Credit Note Items table
CREATE TABLE public.credit_note_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id UUID REFERENCES public.credit_notes(id) ON DELETE CASCADE NOT NULL,
  original_order_id UUID,
  original_invoice_number TEXT,
  product_id UUID,
  product_name TEXT,
  hsn_code TEXT,
  unit TEXT DEFAULT 'Piece',
  quantity NUMERIC(12,3) DEFAULT 0,
  rate NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  taxable_amount NUMERIC(12,2) DEFAULT 0,
  sgst_amount NUMERIC(12,2) DEFAULT 0,
  cgst_amount NUMERIC(12,2) DEFAULT 0,
  barcode TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for credit_notes
CREATE POLICY "Authenticated users can view credit notes" ON public.credit_notes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert credit notes" ON public.credit_notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update credit notes" ON public.credit_notes
  FOR UPDATE TO authenticated USING (true);

-- RLS policies for credit_note_items
CREATE POLICY "Authenticated users can view credit note items" ON public.credit_note_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert credit note items" ON public.credit_note_items
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update credit note items" ON public.credit_note_items
  FOR UPDATE TO authenticated USING (true);

-- Grant permissions
GRANT ALL ON public.credit_notes TO authenticated;
GRANT ALL ON public.credit_notes TO anon;
GRANT ALL ON public.credit_note_items TO authenticated;
GRANT ALL ON public.credit_note_items TO anon;

-- Sequence for credit note numbering
CREATE SEQUENCE IF NOT EXISTS credit_note_number_seq START 1;

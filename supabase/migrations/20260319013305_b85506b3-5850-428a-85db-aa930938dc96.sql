
-- 1. Secondary Sales Invoice table
CREATE TABLE IF NOT EXISTS distributor_secondary_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  retailer_id uuid NOT NULL REFERENCES retailers(id),
  order_id uuid,
  invoice_number text NOT NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  subtotal numeric NOT NULL DEFAULT 0,
  sgst_amount numeric NOT NULL DEFAULT 0,
  cgst_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  balance_due numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'issued',
  notes text,
  pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE distributor_secondary_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage secondary invoices" ON distributor_secondary_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS distributor_secondary_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES distributor_secondary_invoices(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  hsn_code text,
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'Piece',
  rate numeric NOT NULL DEFAULT 0,
  taxable_amount numeric NOT NULL DEFAULT 0,
  sgst_amount numeric NOT NULL DEFAULT 0,
  cgst_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE distributor_secondary_invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage secondary invoice items" ON distributor_secondary_invoice_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE SEQUENCE IF NOT EXISTS distributor_invoice_seq START 1;

-- 2. Distributor credit limit table (company-to-distributor)
CREATE TABLE IF NOT EXISTS distributor_credit_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES distributors(id) ON DELETE CASCADE UNIQUE,
  credit_limit numeric NOT NULL DEFAULT 0,
  credit_days integer NOT NULL DEFAULT 30,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE distributor_credit_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage distributor credit limits" ON distributor_credit_limits FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Order status history for tracking timeline
CREATE TABLE IF NOT EXISTS primary_order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES primary_orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  notes text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE primary_order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view order status history" ON primary_order_status_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION log_primary_order_status_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO primary_order_status_history (order_id, status, notes)
    VALUES (NEW.id, NEW.status, 'Status changed from ' || OLD.status || ' to ' || NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_primary_order_status_change ON primary_orders;
CREATE TRIGGER trg_primary_order_status_change
  AFTER UPDATE ON primary_orders
  FOR EACH ROW EXECUTE FUNCTION log_primary_order_status_change();

CREATE OR REPLACE FUNCTION log_primary_order_initial_status()
RETURNS trigger AS $$
BEGIN
  INSERT INTO primary_order_status_history (order_id, status, notes)
  VALUES (NEW.id, NEW.status, 'Order created');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_primary_order_initial_status ON primary_orders;
CREATE TRIGGER trg_primary_order_initial_status
  AFTER INSERT ON primary_orders
  FOR EACH ROW EXECUTE FUNCTION log_primary_order_initial_status();

-- 4. Retailer feedback table
CREATE TABLE IF NOT EXISTS distributor_retailer_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  retailer_id uuid NOT NULL REFERENCES retailers(id),
  feedback_type text NOT NULL DEFAULT 'general',
  rating integer NOT NULL DEFAULT 5,
  product_quality_rating integer,
  delivery_rating integer,
  service_rating integer,
  comments text,
  follow_up_required boolean NOT NULL DEFAULT false,
  follow_up_notes text,
  follow_up_completed boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE distributor_retailer_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage retailer feedback" ON distributor_retailer_feedback FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger to auto-create ledger entry on secondary invoice
CREATE OR REPLACE FUNCTION auto_ledger_on_secondary_invoice()
RETURNS trigger AS $$
BEGIN
  INSERT INTO distributor_retailer_ledger (
    distributor_id, retailer_id, transaction_date, transaction_type,
    reference_number, description, debit_amount, credit_amount
  ) VALUES (
    NEW.distributor_id, NEW.retailer_id, NEW.invoice_date, 'invoice',
    NEW.invoice_number, 'Invoice ' || NEW.invoice_number,
    NEW.total_amount, 0
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_ledger_secondary_invoice ON distributor_secondary_invoices;
CREATE TRIGGER trg_auto_ledger_secondary_invoice
  AFTER INSERT ON distributor_secondary_invoices
  FOR EACH ROW EXECUTE FUNCTION auto_ledger_on_secondary_invoice();

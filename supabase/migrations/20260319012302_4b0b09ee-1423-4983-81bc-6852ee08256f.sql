
-- Retailer Ledger: tracks all financial transactions per retailer per distributor
CREATE TABLE distributor_retailer_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  retailer_id uuid NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('invoice', 'payment', 'credit_note', 'debit_note', 'opening_balance')),
  reference_id text,
  reference_number text,
  description text,
  debit_amount numeric(12,2) NOT NULL DEFAULT 0,
  credit_amount numeric(12,2) NOT NULL DEFAULT 0,
  running_balance numeric(12,2),
  payment_mode text,
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE distributor_retailer_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage ledger" ON distributor_retailer_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_drl_distributor_retailer ON distributor_retailer_ledger(distributor_id, retailer_id);
CREATE INDEX idx_drl_transaction_date ON distributor_retailer_ledger(transaction_date);

-- Payment collections table
CREATE TABLE distributor_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  retailer_id uuid NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(12,2) NOT NULL,
  payment_mode text NOT NULL DEFAULT 'cash' CHECK (payment_mode IN ('cash', 'upi', 'neft', 'rtgs', 'cheque', 'online', 'other')),
  reference_number text,
  cheque_number text,
  cheque_date date,
  bank_name text,
  notes text,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending', 'bounced', 'cancelled')),
  receipt_number text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE distributor_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage payments" ON distributor_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_dp_distributor_retailer ON distributor_payments(distributor_id, retailer_id);
CREATE INDEX idx_dp_payment_date ON distributor_payments(payment_date);

-- Auto-generate receipt numbers
CREATE SEQUENCE IF NOT EXISTS payment_receipt_seq START 1;

CREATE OR REPLACE FUNCTION generate_payment_receipt_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.receipt_number IS NULL THEN
    NEW.receipt_number := 'RCT-' || TO_CHAR(NOW(), 'YYMM') || '-' || LPAD(nextval('payment_receipt_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_receipt_number
  BEFORE INSERT ON distributor_payments
  FOR EACH ROW
  EXECUTE FUNCTION generate_payment_receipt_number();

-- Auto-insert ledger entry when payment is created
CREATE OR REPLACE FUNCTION auto_ledger_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO distributor_retailer_ledger (
    distributor_id, retailer_id, transaction_date, transaction_type,
    reference_id, reference_number, description,
    debit_amount, credit_amount, payment_mode, created_by
  ) VALUES (
    NEW.distributor_id, NEW.retailer_id, NEW.payment_date, 'payment',
    NEW.id::text, NEW.receipt_number,
    'Payment received via ' || NEW.payment_mode,
    0, NEW.amount, NEW.payment_mode, NEW.created_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_ledger_payment
  AFTER INSERT ON distributor_payments
  FOR EACH ROW
  EXECUTE FUNCTION auto_ledger_on_payment();

-- Retailer credit limits table
CREATE TABLE distributor_retailer_credit_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  retailer_id uuid NOT NULL REFERENCES retailers(id) ON DELETE CASCADE,
  credit_limit numeric(12,2) NOT NULL DEFAULT 0,
  credit_days integer NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(distributor_id, retailer_id)
);

ALTER TABLE distributor_retailer_credit_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage credit limits" ON distributor_retailer_credit_limits FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT ALL ON distributor_retailer_ledger TO authenticated;
GRANT ALL ON distributor_retailer_ledger TO anon;
GRANT ALL ON distributor_payments TO authenticated;
GRANT ALL ON distributor_payments TO anon;
GRANT ALL ON distributor_retailer_credit_limits TO authenticated;
GRANT ALL ON distributor_retailer_credit_limits TO anon;
GRANT USAGE, SELECT ON SEQUENCE payment_receipt_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE payment_receipt_seq TO anon;

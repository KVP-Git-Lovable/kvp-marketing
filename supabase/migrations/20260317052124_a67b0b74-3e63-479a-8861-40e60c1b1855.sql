
-- 1. petty_cash_funds
CREATE TABLE public.petty_cash_funds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  allocated_amount numeric NOT NULL DEFAULT 0,
  balance numeric NOT NULL DEFAULT 0,
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_to date,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. petty_cash_transactions
CREATE TABLE public.petty_cash_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id uuid NOT NULL REFERENCES public.petty_cash_funds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'misc',
  description text,
  bill_url text,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft',
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. petty_cash_limits
CREATE TABLE public.petty_cash_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id uuid NOT NULL REFERENCES public.petty_cash_funds(id) ON DELETE CASCADE,
  max_per_transaction numeric,
  max_per_day numeric,
  require_bill_above numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(fund_id)
);

-- Enable RLS
ALTER TABLE public.petty_cash_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petty_cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petty_cash_limits ENABLE ROW LEVEL SECURITY;

-- RLS for petty_cash_funds
CREATE POLICY "Users can view own funds" ON public.petty_cash_funds
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can manage funds" ON public.petty_cash_funds
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- RLS for petty_cash_transactions
CREATE POLICY "Users can view own transactions" ON public.petty_cash_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users can insert own transactions" ON public.petty_cash_transactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own draft transactions" ON public.petty_cash_transactions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'draft');

CREATE POLICY "Admins can manage all transactions" ON public.petty_cash_transactions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- RLS for petty_cash_limits
CREATE POLICY "Users can view limits for own funds" ON public.petty_cash_limits
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.petty_cash_funds f WHERE f.id = fund_id AND (f.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)))
  );

CREATE POLICY "Admins can manage limits" ON public.petty_cash_limits
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger to update balance on transaction status changes
CREATE OR REPLACE FUNCTION public.update_petty_cash_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'submitted' THEN
    UPDATE petty_cash_funds SET balance = balance - NEW.amount, updated_at = now() WHERE id = NEW.fund_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'submitted' AND NEW.status = 'rejected' THEN
      UPDATE petty_cash_funds SET balance = balance + OLD.amount, updated_at = now() WHERE id = NEW.fund_id;
    ELSIF OLD.status = 'draft' AND NEW.status = 'submitted' THEN
      UPDATE petty_cash_funds SET balance = balance - NEW.amount, updated_at = now() WHERE id = NEW.fund_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_petty_cash_balance
AFTER INSERT OR UPDATE ON public.petty_cash_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_petty_cash_balance();

-- Manager access policies
CREATE POLICY "Managers can view subordinate funds" ON public.petty_cash_funds
  FOR SELECT TO authenticated
  USING (
    user_id IN (SELECT subordinate_user_id FROM public.get_all_subordinates(auth.uid()))
  );

CREATE POLICY "Managers can view subordinate transactions" ON public.petty_cash_transactions
  FOR SELECT TO authenticated
  USING (
    user_id IN (SELECT subordinate_user_id FROM public.get_all_subordinates(auth.uid()))
  );

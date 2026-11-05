-- Add immutable owner snapshot columns to orders and invoices for historical revenue attribution

ALTER TABLE public.orders    ADD COLUMN IF NOT EXISTS owner_id_snapshot uuid;
ALTER TABLE public.invoices  ADD COLUMN IF NOT EXISTS owner_id_snapshot uuid;

CREATE INDEX IF NOT EXISTS idx_orders_owner_snapshot   ON public.orders(owner_id_snapshot);
CREATE INDEX IF NOT EXISTS idx_invoices_owner_snapshot ON public.invoices(owner_id_snapshot);

-- Trigger function: set owner_id_snapshot on insert from retailers.owner_id, fallback to user_id/created_by
CREATE OR REPLACE FUNCTION public.set_order_owner_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF NEW.owner_id_snapshot IS NULL THEN
    IF NEW.retailer_id IS NOT NULL THEN
      SELECT owner_id INTO v_owner FROM public.retailers WHERE id = NEW.retailer_id;
    END IF;
    NEW.owner_id_snapshot := COALESCE(v_owner, NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_invoice_owner_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_user uuid;
BEGIN
  IF NEW.owner_id_snapshot IS NULL THEN
    IF NEW.customer_id IS NOT NULL THEN
      SELECT owner_id INTO v_owner FROM public.retailers WHERE id = NEW.customer_id;
    END IF;
    IF v_owner IS NULL AND NEW.order_id IS NOT NULL THEN
      SELECT COALESCE(owner_id_snapshot, user_id) INTO v_user FROM public.orders WHERE id = NEW.order_id;
    END IF;
    NEW.owner_id_snapshot := COALESCE(v_owner, v_user, NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_order_owner_snapshot ON public.orders;
CREATE TRIGGER trg_set_order_owner_snapshot
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_owner_snapshot();

DROP TRIGGER IF EXISTS trg_set_invoice_owner_snapshot ON public.invoices;
CREATE TRIGGER trg_set_invoice_owner_snapshot
  BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_invoice_owner_snapshot();

-- One-time backfill: existing orders use user_id (they were placed by that user historically).
UPDATE public.orders
SET owner_id_snapshot = user_id
WHERE owner_id_snapshot IS NULL AND user_id IS NOT NULL;

-- For invoices, prefer the linked order's snapshot, then created_by.
UPDATE public.invoices i
SET owner_id_snapshot = COALESCE(o.owner_id_snapshot, o.user_id, i.created_by)
FROM public.orders o
WHERE i.order_id = o.id AND i.owner_id_snapshot IS NULL;

UPDATE public.invoices
SET owner_id_snapshot = created_by
WHERE owner_id_snapshot IS NULL AND created_by IS NOT NULL;

-- Add a payments-history table for collection audit trail
CREATE TABLE IF NOT EXISTS public.retailer_payment_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL REFERENCES public.retailers(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_method text,
  payment_proof_url text,
  upi_last_four text,
  notes text,
  collected_by_user_id uuid NOT NULL,    -- operational credit (who did the collection)
  revenue_owner_id uuid,                  -- revenue credit (whose dues these were)
  collected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rpc_retailer       ON public.retailer_payment_collections(retailer_id);
CREATE INDEX IF NOT EXISTS idx_rpc_collected_by   ON public.retailer_payment_collections(collected_by_user_id);
CREATE INDEX IF NOT EXISTS idx_rpc_revenue_owner  ON public.retailer_payment_collections(revenue_owner_id);
CREATE INDEX IF NOT EXISTS idx_rpc_collected_at   ON public.retailer_payment_collections(collected_at DESC);

ALTER TABLE public.retailer_payment_collections ENABLE ROW LEVEL SECURITY;

-- Users can see collections they did OR collections on retailers they own
CREATE POLICY "View own or owned collections"
ON public.retailer_payment_collections FOR SELECT
USING (
  collected_by_user_id = auth.uid()
  OR revenue_owner_id = auth.uid()
  OR public.is_system_admin(auth.uid())
);

CREATE POLICY "Insert own collections"
ON public.retailer_payment_collections FOR INSERT
WITH CHECK (collected_by_user_id = auth.uid());

CREATE POLICY "Admin manage collections"
ON public.retailer_payment_collections FOR ALL
USING (public.is_system_admin(auth.uid()))
WITH CHECK (public.is_system_admin(auth.uid()));
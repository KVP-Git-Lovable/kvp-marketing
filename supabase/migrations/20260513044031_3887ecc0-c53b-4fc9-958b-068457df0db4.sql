
-- MIGRATION 1: counter_customers
ALTER TABLE public.counter_customers
  ALTER COLUMN phone SET NOT NULL,
  ALTER COLUMN name DROP NOT NULL;

ALTER TABLE public.counter_customers
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_spent NUMERIC(12,2) DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'counter_customers_phone_user_unique'
  ) THEN
    ALTER TABLE public.counter_customers
      ADD CONSTRAINT counter_customers_phone_user_unique UNIQUE (phone, user_id);
  END IF;
END $$;

-- MIGRATION 2: orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sales_channel TEXT NOT NULL DEFAULT 'field';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_sales_channel_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_sales_channel_check
      CHECK (sales_channel IN ('field', 'counter', 'event'));
  END IF;
END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.activity_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_sales_channel ON public.orders(sales_channel);
CREATE INDEX IF NOT EXISTS idx_orders_event_id ON public.orders(event_id);

-- MIGRATION 3: activity_events
ALTER TABLE public.activity_events
  ADD COLUMN IF NOT EXISTS target_mode TEXT DEFAULT 'collective',
  ADD COLUMN IF NOT EXISTS collective_target NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS individual_target NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS price_book_id UUID,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'upcoming';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activity_events_target_mode_check') THEN
    ALTER TABLE public.activity_events
      ADD CONSTRAINT activity_events_target_mode_check
      CHECK (target_mode IN ('individual', 'collective'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activity_events_status_check') THEN
    ALTER TABLE public.activity_events
      ADD CONSTRAINT activity_events_status_check
      CHECK (status IN ('upcoming', 'active', 'closed'));
  END IF;
END $$;

-- MIGRATION 4: event_team_members
CREATE TABLE IF NOT EXISTS public.event_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.activity_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  individual_target NUMERIC(12,2),
  role TEXT DEFAULT 'sales_rep',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_team_event_id ON public.event_team_members(event_id);
CREATE INDEX IF NOT EXISTS idx_event_team_user_id ON public.event_team_members(user_id);

ALTER TABLE public.event_team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_team_member_select_own" ON public.event_team_members;
CREATE POLICY "event_team_member_select_own"
  ON public.event_team_members FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "event_team_creator_select" ON public.event_team_members;
CREATE POLICY "event_team_creator_select"
  ON public.event_team_members FOR SELECT
  USING (event_id IN (SELECT id FROM public.activity_events WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "event_team_creator_write" ON public.event_team_members;
CREATE POLICY "event_team_creator_write"
  ON public.event_team_members FOR ALL
  USING (event_id IN (SELECT id FROM public.activity_events WHERE user_id = auth.uid()));

-- MIGRATION 5: sync_order_with_items RPC update
CREATE OR REPLACE FUNCTION public.sync_order_with_items(p_order jsonb, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_existing_order_id uuid;
  v_items_count int := 0;
BEGIN
  v_order_id := (p_order->>'id')::uuid;

  IF v_order_id IS NOT NULL THEN
    SELECT id INTO v_existing_order_id FROM orders WHERE id = v_order_id;
  END IF;

  IF v_existing_order_id IS NOT NULL THEN
    SELECT count(*) INTO v_items_count FROM order_items WHERE order_id = v_existing_order_id;

    IF v_items_count = 0 AND jsonb_array_length(p_items) > 0 THEN
      INSERT INTO order_items (
        order_id, product_id, product_name, variant_name, quantity,
        price, total, scheme_discount, scheme_name, category_id, hsn_code
      )
      SELECT
        v_existing_order_id,
        (item->>'product_id')::uuid,
        item->>'product_name',
        item->>'variant_name',
        COALESCE((item->>'quantity')::int, 0),
        COALESCE((item->>'price')::numeric, 0),
        COALESCE((item->>'total')::numeric, 0),
        COALESCE((item->>'scheme_discount')::numeric, 0),
        item->>'scheme_name',
        NULLIF(item->>'category_id', '')::uuid,
        item->>'hsn_code'
      FROM jsonb_array_elements(p_items) AS item;
    END IF;

    RETURN jsonb_build_object('order_id', v_existing_order_id, 'status', 'existing', 'items_inserted', v_items_count = 0);
  END IF;

  INSERT INTO orders (
    id, user_id, retailer_id, retailer_name, visit_id, beat_name,
    order_date, total_amount, total_qty, status, payment_method,
    is_credit_order, credit_pending_amount, credit_paid_amount,
    previous_pending_cleared, invoice_number, idempotency_key,
    sales_channel, event_id,
    created_at, updated_at
  ) VALUES (
    COALESCE(v_order_id, gen_random_uuid()),
    NULLIF(p_order->>'user_id', '')::uuid,
    NULLIF(p_order->>'retailer_id', '')::uuid,
    p_order->>'retailer_name',
    NULLIF(p_order->>'visit_id', '')::uuid,
    p_order->>'beat_name',
    COALESCE(p_order->>'order_date', CURRENT_DATE::text),
    COALESCE((p_order->>'total_amount')::numeric, 0),
    COALESCE((p_order->>'total_qty')::int, 0),
    COALESCE(p_order->>'status', 'pending'),
    p_order->>'payment_method',
    COALESCE((p_order->>'is_credit_order')::boolean, false),
    COALESCE((p_order->>'credit_pending_amount')::numeric, 0),
    COALESCE((p_order->>'credit_paid_amount')::numeric, 0),
    COALESCE((p_order->>'previous_pending_cleared')::numeric, 0),
    p_order->>'invoice_number',
    p_order->>'idempotency_key',
    COALESCE(NULLIF(p_order->>'sales_channel', ''), 'field'),
    NULLIF(p_order->>'event_id', '')::uuid,
    COALESCE((p_order->>'created_at')::timestamptz, now()),
    now()
  )
  RETURNING id INTO v_order_id;

  IF jsonb_array_length(p_items) > 0 THEN
    INSERT INTO order_items (
      order_id, product_id, product_name, variant_name, quantity,
      price, total, scheme_discount, scheme_name, category_id, hsn_code
    )
    SELECT
      v_order_id,
      (item->>'product_id')::uuid,
      item->>'product_name',
      item->>'variant_name',
      COALESCE((item->>'quantity')::int, 0),
      COALESCE((item->>'price')::numeric, 0),
      COALESCE((item->>'total')::numeric, 0),
      COALESCE((item->>'scheme_discount')::numeric, 0),
      item->>'scheme_name',
      NULLIF(item->>'category_id', '')::uuid,
      item->>'hsn_code'
    FROM jsonb_array_elements(p_items) AS item;
  END IF;

  RETURN jsonb_build_object('order_id', v_order_id, 'status', 'created', 'items_inserted', true);

EXCEPTION WHEN unique_violation THEN
  SELECT id INTO v_order_id FROM orders WHERE id = (p_order->>'id')::uuid;
  RETURN jsonb_build_object('order_id', COALESCE(v_order_id, gen_random_uuid()), 'status', 'conflict', 'items_inserted', false);
END;
$function$;

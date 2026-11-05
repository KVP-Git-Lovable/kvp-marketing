SET LOCAL check_function_bodies = false;
SET LOCAL search_path = public, extensions;
CREATE SEQUENCE IF NOT EXISTS public.price_book_entry_audit_id_seq;
CREATE OR REPLACE FUNCTION public.feedback_protect_builtin_module()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_builtin THEN
      RAISE EXCEPTION 'The % feedback type is built in and cannot be removed. Switch it off instead.', OLD.label
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.is_builtin AND NEW.module <> OLD.module THEN
    RAISE EXCEPTION 'The key of a built-in feedback type cannot be changed'
      USING ERRCODE = '42501';
  END IF;
  IF OLD.is_builtin AND NEW.is_builtin = false THEN
    RAISE EXCEPTION 'A built-in feedback type cannot be converted to a custom one'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.price_book_setup_tasks_touch()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if new.status in ('completed','not_applicable')
     and (old.status is null or old.status not in ('completed','not_applicable')) then
    new.completed_date := coalesce(new.completed_date, current_date);
  elsif new.status not in ('completed','not_applicable') then
    new.completed_date := null;
  end if;
  return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.tg_guard_locked_tiers()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_locked boolean;
BEGIN
  SELECT is_locked INTO v_locked FROM loyalty_tier_config
   WHERE entity_type = COALESCE(NEW.entity_type, OLD.entity_type);

  IF COALESCE(v_locked, false) THEN
    -- Renaming, recolouring or reordering a badge is cosmetic and stays open.
    -- Only the numbers that move retailers between badges are held.
    IF TG_OP = 'DELETE'
       OR (TG_OP = 'INSERT')
       OR (TG_OP = 'UPDATE' AND (NEW.min_points IS DISTINCT FROM OLD.min_points
                              OR NEW.max_points IS DISTINCT FROM OLD.max_points
                              OR NEW.is_active  IS DISTINCT FROM OLD.is_active)) THEN
      RAISE EXCEPTION
        'Badge levels for % are locked. Unlock them before changing the point ranges.',
        COALESCE(NEW.entity_type, OLD.entity_type);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END; $function$
;
CREATE OR REPLACE FUNCTION public.tg_van_sync_odometer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only ever moves forward: a tracker reporting a stale or lower value must
  -- not wind the vehicle back.
  UPDATE public.vans
     SET current_odometer_km = NEW.reading_km,
         odometer_updated_at = NEW.recorded_at,
         updated_at = now()
   WHERE id = NEW.van_id
     AND (current_odometer_km IS NULL
          OR NEW.reading_km >= current_odometer_km
          OR odometer_updated_at IS NULL
          OR NEW.recorded_at > odometer_updated_at);
  RETURN NEW;
END; $function$
;
CREATE TABLE public.distributor_invoice_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  distributor_id uuid NOT NULL,
  setting_key text NOT NULL,
  enabled boolean NOT NULL,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.distributor_invoice_settings ADD CONSTRAINT distributor_invoice_settings_pkey PRIMARY KEY (id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.distributor_invoice_settings ADD CONSTRAINT distributor_invoice_settings_distributor_id_setting_key_key UNIQUE (distributor_id, setting_key)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE INDEX distributor_invoice_settings_distributor_idx ON public.distributor_invoice_settings USING btree (distributor_id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
CREATE TABLE public.document_counters (
  scope text NOT NULL,
  next_value bigint NOT NULL DEFAULT 1,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.document_counters ADD CONSTRAINT document_counters_pkey PRIMARY KEY (scope)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
CREATE TABLE public.exchange_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  base_currency text NOT NULL,
  quote_currency text NOT NULL,
  rate numeric NOT NULL,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  source text NOT NULL DEFAULT 'manual'::text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.exchange_rates ADD CONSTRAINT exchange_rates_rate_check CHECK (rate > 0::numeric)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.exchange_rates ADD CONSTRAINT exchange_rates_pkey PRIMARY KEY (id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.exchange_rates ADD CONSTRAINT exchange_rates_base_currency_quote_currency_effective_date__key UNIQUE (base_currency, quote_currency, effective_date, source)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE INDEX idx_exchange_rates_lookup ON public.exchange_rates USING btree (base_currency, quote_currency, effective_date DESC)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
CREATE TABLE public.feedback_module_config (
  module text NOT NULL,
  label text NOT NULL,
  scored boolean NOT NULL DEFAULT true,
  display_scale numeric NOT NULL DEFAULT 10,
  decimals integer NOT NULL DEFAULT 1,
  bands jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  description text,
  icon text NOT NULL DEFAULT 'MessageSquare'::text,
  color text NOT NULL DEFAULT 'blue'::text,
  is_builtin boolean NOT NULL DEFAULT false,
  show_on_visit boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.feedback_module_config ADD CONSTRAINT feedback_module_config_bands_shape CHECK (jsonb_typeof(bands) = 'array'::text)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.feedback_module_config ADD CONSTRAINT feedback_module_config_key_shape CHECK (module ~ '^[a-z][a-z0-9_]{1,40}$'::text)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.feedback_module_config ADD CONSTRAINT feedback_module_config_scale_positive CHECK (display_scale > 0::numeric)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.feedback_module_config ADD CONSTRAINT feedback_module_config_pkey PRIMARY KEY (module)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
CREATE TABLE public.feedback_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  module text NOT NULL,
  question_id uuid NOT NULL,
  subject_table text,
  subject_id uuid,
  user_id uuid NOT NULL,
  retailer_id uuid,
  visit_id uuid,
  value_number numeric,
  value_text text,
  value_option text,
  points numeric,
  max_points numeric,
  answered_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.feedback_responses ADD CONSTRAINT feedback_responses_pkey PRIMARY KEY (id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE INDEX idx_feedback_responses_module_user ON public.feedback_responses USING btree (module, user_id, answered_at DESC)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE INDEX idx_feedback_responses_question ON public.feedback_responses USING btree (question_id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE INDEX idx_feedback_responses_subject ON public.feedback_responses USING btree (subject_table, subject_id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE UNIQUE INDEX uq_feedback_responses_one_per_question ON public.feedback_responses USING btree (subject_table, subject_id, question_id) WHERE (subject_id IS NOT NULL)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
CREATE TABLE public.fleet_api_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  mode text NOT NULL DEFAULT 'webhook'::text,
  is_enabled boolean NOT NULL DEFAULT false,
  webhook_secret text,
  api_base_url text,
  api_key_secret_name text,
  auth_header text DEFAULT 'Authorization'::text,
  auth_prefix text DEFAULT 'Bearer'::text,
  field_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  odometer_unit text NOT NULL DEFAULT 'km'::text,
  reading_mode text NOT NULL DEFAULT 'cumulative'::text,
  records_path text,
  last_sync_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.fleet_api_config ADD CONSTRAINT fleet_api_mode_chk CHECK (mode = ANY (ARRAY['webhook'::text, 'poll'::text]))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.fleet_api_config ADD CONSTRAINT fleet_api_rmode_chk CHECK (reading_mode = ANY (ARRAY['cumulative'::text, 'trip'::text]))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.fleet_api_config ADD CONSTRAINT fleet_api_unit_chk CHECK (odometer_unit = ANY (ARRAY['km'::text, 'm'::text, 'miles'::text]))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.fleet_api_config ADD CONSTRAINT fleet_api_config_pkey PRIMARY KEY (id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.fleet_api_config ADD CONSTRAINT fleet_api_config_provider_key UNIQUE (provider)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
CREATE TABLE public.fleet_api_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  provider text,
  direction text NOT NULL DEFAULT 'inbound'::text,
  device_id text,
  van_id uuid,
  status text NOT NULL,
  message text,
  payload jsonb,
  received_at timestamp with time zone NOT NULL DEFAULT now()
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.fleet_api_log ADD CONSTRAINT fleet_log_dir_chk CHECK (direction = ANY (ARRAY['inbound'::text, 'outbound'::text]))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.fleet_api_log ADD CONSTRAINT fleet_log_status_chk CHECK (status = ANY (ARRAY['ok'::text, 'rejected'::text, 'error'::text, 'ignored'::text]))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.fleet_api_log ADD CONSTRAINT fleet_api_log_pkey PRIMARY KEY (id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE INDEX idx_fleet_log_status ON public.fleet_api_log USING btree (status, received_at DESC)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE INDEX idx_fleet_log_time ON public.fleet_api_log USING btree (received_at DESC)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
CREATE TABLE public.invoice_generation_failures (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid,
  failed_at timestamp with time zone NOT NULL DEFAULT now(),
  sqlstate text,
  message text,
  context jsonb
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.invoice_generation_failures ADD CONSTRAINT invoice_generation_failures_pkey PRIMARY KEY (id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE INDEX idx_invoice_gen_fail_order ON public.invoice_generation_failures USING btree (order_id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE INDEX idx_invoice_gen_fail_time ON public.invoice_generation_failures USING btree (failed_at DESC)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
CREATE TABLE public.loyalty_tier_awards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  tier_name text NOT NULL,
  tier_rank integer NOT NULL,
  achieved_at timestamp with time zone NOT NULL DEFAULT now(),
  period_key text,
  points_at_award numeric
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.loyalty_tier_awards ADD CONSTRAINT loyalty_tier_awards_pkey PRIMARY KEY (id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.loyalty_tier_awards ADD CONSTRAINT tier_award_once UNIQUE (entity_type, entity_id, tier_name)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE INDEX idx_tier_awards_entity ON public.loyalty_tier_awards USING btree (entity_type, entity_id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
CREATE TABLE public.loyalty_tier_config (
  entity_type text NOT NULL,
  points_basis text NOT NULL DEFAULT 'loyalty_points'::text,
  evaluation_period text NOT NULL DEFAULT 'lifetime'::text,
  value_per_point numeric NOT NULL DEFAULT 100,
  protect_from_reset boolean NOT NULL DEFAULT true,
  allow_demotion boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_locked boolean NOT NULL DEFAULT true,
  locked_at timestamp with time zone DEFAULT now(),
  locked_by uuid
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.loyalty_tier_config ADD CONSTRAINT tier_basis_chk CHECK (points_basis = ANY (ARRAY['loyalty_points'::text, 'order_value'::text]))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.loyalty_tier_config ADD CONSTRAINT tier_cfg_entity_chk CHECK (entity_type = ANY (ARRAY['retailer'::text, 'distributor'::text]))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.loyalty_tier_config ADD CONSTRAINT tier_period_chk CHECK (evaluation_period = ANY (ARRAY['lifetime'::text, 'monthly'::text, 'quarterly'::text, 'half_yearly'::text, 'annual'::text, 'financial_year'::text]))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.loyalty_tier_config ADD CONSTRAINT loyalty_tier_config_pkey PRIMARY KEY (entity_type)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
CREATE TABLE public.notification_banner_dismissals (
  banner_id uuid NOT NULL,
  user_id uuid NOT NULL,
  dismissed_at timestamp with time zone NOT NULL DEFAULT now()
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.notification_banner_dismissals ADD CONSTRAINT notification_banner_dismissals_pkey PRIMARY KEY (banner_id, user_id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
CREATE TABLE public.notification_banners (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  cta_label text,
  cta_link text,
  theme text NOT NULL DEFAULT 'indigo'::text,
  audience_type text NOT NULL DEFAULT 'all'::text,
  audience_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  portals text[] NOT NULL DEFAULT ARRAY['field_sales_app'::text],
  starts_at timestamp with time zone NOT NULL DEFAULT now(),
  ends_at timestamp with time zone,
  dismissible boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.notification_banners ADD CONSTRAINT notification_banners_audience_ids_check CHECK (audience_type = 'all'::text OR COALESCE(array_length(audience_ids, 1), 0) >= 1)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.notification_banners ADD CONSTRAINT notification_banners_audience_type_check CHECK (audience_type = ANY (ARRAY['all'::text, 'role'::text, 'user'::text]))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.notification_banners ADD CONSTRAINT notification_banners_portals_check CHECK (COALESCE(array_length(portals, 1), 0) >= 1)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.notification_banners ADD CONSTRAINT notification_banners_window_check CHECK (ends_at IS NULL OR ends_at > starts_at)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.notification_banners ADD CONSTRAINT notification_banners_pkey PRIMARY KEY (id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE INDEX notification_banners_live_idx ON public.notification_banners USING btree (is_active, starts_at, ends_at)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
CREATE TABLE public.person_engagement_scores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  retailer_id uuid NOT NULL,
  score numeric NOT NULL DEFAULT 0,
  last_event_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.person_engagement_scores ADD CONSTRAINT person_engagement_scores_pkey PRIMARY KEY (id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.person_engagement_scores ADD CONSTRAINT person_engagement_scores_retailer_id_key UNIQUE (retailer_id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
CREATE TABLE public.price_book_entry_audit (
  id bigint NOT NULL DEFAULT nextval('price_book_entry_audit_id_seq'::regclass),
  price_book_id uuid NOT NULL,
  entry_id uuid,
  product_id uuid,
  variant_id uuid,
  action text NOT NULL,
  changed_fields text[] NOT NULL DEFAULT '{}'::text[],
  old_values jsonb,
  new_values jsonb,
  changed_by uuid,
  changed_at timestamp with time zone NOT NULL DEFAULT now()
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.price_book_entry_audit ADD CONSTRAINT price_book_entry_audit_action_check CHECK (action = ANY (ARRAY['created'::text, 'updated'::text, 'removed'::text]))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.price_book_entry_audit ADD CONSTRAINT price_book_entry_audit_pkey PRIMARY KEY (id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE INDEX pbe_audit_book_idx ON public.price_book_entry_audit USING btree (price_book_id, changed_at DESC)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE INDEX pbe_audit_entry_idx ON public.price_book_entry_audit USING btree (entry_id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
CREATE TABLE public.price_book_setup_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  owner_user_id uuid,
  notes text,
  due_date date,
  completed_date date,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.price_book_setup_tasks ADD CONSTRAINT price_book_setup_tasks_status_check CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'blocked'::text, 'not_applicable'::text]))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.price_book_setup_tasks ADD CONSTRAINT price_book_setup_tasks_pkey PRIMARY KEY (id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.price_book_setup_tasks ADD CONSTRAINT price_book_setup_tasks_task_key_key UNIQUE (task_key)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE INDEX price_book_setup_tasks_status_idx ON public.price_book_setup_tasks USING btree (status)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
CREATE TABLE public.product_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid,
  changed_by_name text,
  changed_at timestamp with time zone NOT NULL DEFAULT now()
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.product_audit_log ADD CONSTRAINT product_audit_log_entity_type_check CHECK (entity_type = ANY (ARRAY['product'::text, 'variant'::text, 'uom_master'::text, 'order_items'::text, 'invoice_items'::text, 'retailer_payment_allocations'::text, 'retailer_pending_audit'::text, 'credit_note_items'::text, 'credit_ledger'::text, 'credit_notes'::text, 'orders'::text, 'invoices'::text, 'security_profiles'::text, 'profile_object_permissions'::text, 'user_object_permissions'::text, 'van_live_inventory'::text, 'van_stock_opening_edits'::text, 'primary_order_items'::text, 'distributor_return_items'::text, 'delivery_challan_items'::text, 'grn_items'::text, 'gamification_points'::text]))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.product_audit_log ADD CONSTRAINT product_audit_log_pkey PRIMARY KEY (id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE INDEX idx_product_audit_log_entity ON public.product_audit_log USING btree (entity_type, entity_id, changed_at DESC)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
CREATE TABLE public.product_mrp_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid,
  variant_id uuid,
  state text NOT NULL,
  mrp numeric NOT NULL,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.product_mrp_overrides ADD CONSTRAINT product_mrp_override_target CHECK (product_id IS NOT NULL OR variant_id IS NOT NULL)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.product_mrp_overrides ADD CONSTRAINT product_mrp_overrides_mrp_check CHECK (mrp > 0::numeric)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.product_mrp_overrides ADD CONSTRAINT product_mrp_overrides_pkey PRIMARY KEY (id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE UNIQUE INDEX product_mrp_override_unique ON public.product_mrp_overrides USING btree (COALESCE(variant_id, product_id), lower(state), effective_from)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
CREATE TABLE public.product_price_change_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  sku text,
  product_name text,
  old_rate numeric,
  new_rate numeric,
  changed_by uuid,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  unlocked_via_reauth boolean NOT NULL DEFAULT true
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.product_price_change_log ADD CONSTRAINT product_price_change_log_pkey PRIMARY KEY (id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE INDEX idx_product_price_change_log_changed_at ON public.product_price_change_log USING btree (changed_at DESC)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE INDEX idx_product_price_change_log_product_id ON public.product_price_change_log USING btree (product_id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
CREATE TABLE public.qa_custom_tests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  prompt text NOT NULL,
  page_context text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  run_at timestamp with time zone,
  status text NOT NULL DEFAULT 'pending'::text,
  ai_plan text,
  ai_result text,
  steps_taken jsonb,
  pass boolean,
  error_message text,
  created_by uuid,
  test_run_id uuid
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.qa_custom_tests ADD CONSTRAINT qa_custom_tests_pkey PRIMARY KEY (id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
CREATE TABLE public.retailer_loyalty_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tier_name text NOT NULL,
  min_points numeric NOT NULL,
  max_points numeric,
  colour text NOT NULL,
  icon text,
  benefits text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  entity_type text NOT NULL DEFAULT 'retailer'::text
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.retailer_loyalty_tiers ADD CONSTRAINT tier_entity_type_chk CHECK (entity_type = ANY (ARRAY['retailer'::text, 'distributor'::text]))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.retailer_loyalty_tiers ADD CONSTRAINT tier_range_sane CHECK (max_points IS NULL OR max_points > min_points)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.retailer_loyalty_tiers ADD CONSTRAINT retailer_loyalty_tiers_pkey PRIMARY KEY (id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.retailer_loyalty_tiers ADD CONSTRAINT tier_name_per_entity UNIQUE (entity_type, tier_name)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
CREATE TABLE public.scheme_free_product_stock_movements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  scheme_free_product_id uuid NOT NULL,
  movement_type text NOT NULL,
  quantity numeric NOT NULL,
  running_balance numeric NOT NULL,
  order_id uuid,
  order_item_id uuid,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.scheme_free_product_stock_movements ADD CONSTRAINT scheme_free_product_stock_movements_movement_type_check CHECK (movement_type = ANY (ARRAY['stock_in'::text, 'order_consumption'::text, 'reversal'::text, 'adjustment'::text]))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.scheme_free_product_stock_movements ADD CONSTRAINT scheme_free_product_stock_movements_pkey PRIMARY KEY (id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
CREATE TABLE public.scheme_free_products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  unit text NOT NULL DEFAULT 'kg'::text,
  hsn_code text,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  stock_quantity numeric NOT NULL DEFAULT 0,
  low_stock_threshold numeric
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.scheme_free_products ADD CONSTRAINT scheme_free_products_pkey PRIMARY KEY (id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
CREATE TABLE public.user_distributors (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  distributor_id uuid NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  assigned_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.user_distributors ADD CONSTRAINT user_distributors_pkey PRIMARY KEY (id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.user_distributors ADD CONSTRAINT user_distributors_user_id_distributor_id_key UNIQUE (user_id, distributor_id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE INDEX user_distributors_distributor_idx ON public.user_distributors USING btree (distributor_id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE UNIQUE INDEX user_distributors_one_primary ON public.user_distributors USING btree (user_id) WHERE (is_primary AND is_active)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE INDEX user_distributors_user_idx ON public.user_distributors USING btree (user_id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
CREATE TABLE public.van_expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  van_id uuid NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL,
  amount numeric NOT NULL,
  odometer_km numeric,
  quantity numeric,
  rate numeric,
  vendor text,
  reference_no text,
  notes text,
  bill_url text,
  recorded_by uuid,
  source text NOT NULL DEFAULT 'manual'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.van_expenses ADD CONSTRAINT van_expense_category_chk CHECK (category = ANY (ARRAY['fuel'::text, 'service'::text, 'repair'::text, 'tyre'::text, 'rent'::text, 'insurance'::text, 'permit'::text, 'toll'::text, 'driver_salary'::text, 'fine'::text, 'cleaning'::text, 'other'::text]))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.van_expenses ADD CONSTRAINT van_expense_source_chk CHECK (source = ANY (ARRAY['manual'::text, 'device'::text, 'import'::text]))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.van_expenses ADD CONSTRAINT van_expenses_amount_check CHECK (amount >= 0::numeric)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.van_expenses ADD CONSTRAINT van_expenses_pkey PRIMARY KEY (id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE INDEX idx_van_expenses_category ON public.van_expenses USING btree (category, expense_date)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE INDEX idx_van_expenses_van_date ON public.van_expenses USING btree (van_id, expense_date)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
CREATE TABLE public.van_odometer_readings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  van_id uuid NOT NULL,
  reading_km numeric NOT NULL,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'device'::text,
  device_id text,
  latitude numeric,
  longitude numeric,
  raw jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.van_odometer_readings ADD CONSTRAINT van_odo_source_chk CHECK (source = ANY (ARRAY['device'::text, 'manual'::text, 'van_stock'::text]))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.van_odometer_readings ADD CONSTRAINT van_odometer_readings_reading_km_check CHECK (reading_km >= 0::numeric)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.van_odometer_readings ADD CONSTRAINT van_odometer_readings_pkey PRIMARY KEY (id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE INDEX idx_van_odo_van_time ON public.van_odometer_readings USING btree (van_id, recorded_at DESC)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
CREATE TABLE public.van_service_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  van_id uuid NOT NULL,
  service_type text NOT NULL,
  interval_km numeric,
  interval_days integer,
  last_done_km numeric,
  last_done_date date,
  next_due_km numeric,
  next_due_date date,
  alert_before_km numeric DEFAULT 500,
  alert_before_days integer DEFAULT 7,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.van_service_schedule ADD CONSTRAINT van_service_interval_chk CHECK (interval_km IS NOT NULL OR interval_days IS NOT NULL)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.van_service_schedule ADD CONSTRAINT van_service_schedule_pkey PRIMARY KEY (id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE INDEX idx_van_service_van ON public.van_service_schedule USING btree (van_id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.distributor_invoice_settings ADD CONSTRAINT distributor_invoice_settings_distributor_id_fkey FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.distributor_invoice_settings ADD CONSTRAINT distributor_invoice_settings_setting_key_fkey FOREIGN KEY (setting_key) REFERENCES invoice_display_settings(setting_key) ON DELETE CASCADE$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.feedback_responses ADD CONSTRAINT feedback_responses_question_id_fkey FOREIGN KEY (question_id) REFERENCES feedback_questions(id) ON DELETE RESTRICT$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.notification_banner_dismissals ADD CONSTRAINT notification_banner_dismissals_banner_id_fkey FOREIGN KEY (banner_id) REFERENCES notification_banners(id) ON DELETE CASCADE$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.notification_banner_dismissals ADD CONSTRAINT notification_banner_dismissals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.notification_banners ADD CONSTRAINT notification_banners_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.person_engagement_scores ADD CONSTRAINT person_engagement_scores_retailer_id_fkey FOREIGN KEY (retailer_id) REFERENCES retailers(id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.price_book_setup_tasks ADD CONSTRAINT price_book_setup_tasks_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES profiles(id) ON DELETE SET NULL$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.product_mrp_overrides ADD CONSTRAINT product_mrp_overrides_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.product_mrp_overrides ADD CONSTRAINT product_mrp_overrides_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.product_price_change_log ADD CONSTRAINT product_price_change_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.product_price_change_log ADD CONSTRAINT product_price_change_log_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.scheme_free_product_stock_movements ADD CONSTRAINT scheme_free_product_stock_movements_scheme_free_product_id_fkey FOREIGN KEY (scheme_free_product_id) REFERENCES scheme_free_products(id)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.user_distributors ADD CONSTRAINT user_distributors_distributor_id_fkey FOREIGN KEY (distributor_id) REFERENCES distributors(id) ON DELETE CASCADE$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.user_distributors ADD CONSTRAINT user_distributors_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.van_expenses ADD CONSTRAINT van_expenses_van_id_fkey FOREIGN KEY (van_id) REFERENCES vans(id) ON DELETE CASCADE$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.van_odometer_readings ADD CONSTRAINT van_odometer_readings_van_id_fkey FOREIGN KEY (van_id) REFERENCES vans(id) ON DELETE CASCADE$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.van_service_schedule ADD CONSTRAINT van_service_schedule_van_id_fkey FOREIGN KEY (van_id) REFERENCES vans(id) ON DELETE CASCADE$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.distributor_invoice_settings ENABLE ROW LEVEL SECURITY$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.document_counters ENABLE ROW LEVEL SECURITY$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.feedback_module_config ENABLE ROW LEVEL SECURITY$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.feedback_responses ENABLE ROW LEVEL SECURITY$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.fleet_api_config ENABLE ROW LEVEL SECURITY$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.fleet_api_log ENABLE ROW LEVEL SECURITY$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.invoice_generation_failures ENABLE ROW LEVEL SECURITY$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.loyalty_tier_awards ENABLE ROW LEVEL SECURITY$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.loyalty_tier_config ENABLE ROW LEVEL SECURITY$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.notification_banner_dismissals ENABLE ROW LEVEL SECURITY$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.notification_banners ENABLE ROW LEVEL SECURITY$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.person_engagement_scores ENABLE ROW LEVEL SECURITY$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.price_book_entry_audit ENABLE ROW LEVEL SECURITY$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.price_book_setup_tasks ENABLE ROW LEVEL SECURITY$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.product_audit_log ENABLE ROW LEVEL SECURITY$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.product_price_change_log ENABLE ROW LEVEL SECURITY$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.qa_custom_tests ENABLE ROW LEVEL SECURITY$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.retailer_loyalty_tiers ENABLE ROW LEVEL SECURITY$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.scheme_free_product_stock_movements ENABLE ROW LEVEL SECURITY$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.scheme_free_products ENABLE ROW LEVEL SECURITY$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.user_distributors ENABLE ROW LEVEL SECURITY$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.van_expenses ENABLE ROW LEVEL SECURITY$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.van_odometer_readings ENABLE ROW LEVEL SECURITY$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$ALTER TABLE public.van_service_schedule ENABLE ROW LEVEL SECURITY$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY distributor_invoice_settings_select ON public.distributor_invoice_settings AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() IS NOT NULL))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY distributor_invoice_settings_write ON public.distributor_invoice_settings AS PERMISSIVE FOR ALL TO public USING (user_has_permission(auth.uid(), 'module_distributor_master'::text, 'can_edit'::text)) WITH CHECK (user_has_permission(auth.uid(), 'module_distributor_master'::text, 'can_edit'::text))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY exchange_rates_read_authenticated ON public.exchange_rates AS PERMISSIVE FOR SELECT TO authenticated USING (true)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY exchange_rates_write_admins ON public.exchange_rates AS PERMISSIVE FOR ALL TO authenticated USING (is_admin_or_manager()) WITH CHECK (is_admin_or_manager())$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "Admins manage feedback_module_config" ON public.feedback_module_config AS PERMISSIVE FOR ALL TO authenticated USING (is_system_admin(auth.uid())) WITH CHECK (is_system_admin(auth.uid()))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "Authenticated read feedback_module_config" ON public.feedback_module_config AS PERMISSIVE FOR SELECT TO authenticated USING (true)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "Admins manage feedback_responses" ON public.feedback_responses AS PERMISSIVE FOR DELETE TO authenticated USING (is_system_admin(auth.uid()))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "Read own or reporting-line feedback_responses" ON public.feedback_responses AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR is_system_admin(auth.uid()) OR COALESCE(report_can_view_user(auth.uid(), user_id), false)))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "Users insert their own feedback_responses" ON public.feedback_responses AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "Users update their own feedback_responses" ON public.feedback_responses AS PERMISSIVE FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "admins manage fleet api" ON public.fleet_api_config AS PERMISSIVE FOR ALL TO authenticated USING (is_system_admin(auth.uid())) WITH CHECK (is_system_admin(auth.uid()))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "read fleet log" ON public.fleet_api_log AS PERMISSIVE FOR SELECT TO authenticated USING (is_admin_or_manager())$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "Invoice failures readable by invoice managers" ON public.invoice_generation_failures AS PERMISSIVE FOR SELECT TO public USING ((user_has_permission(auth.uid(), 'admin_invoice_mgmt'::text, 'can_read'::text) OR user_has_permission(auth.uid(), 'module_invoices'::text, 'can_read'::text)))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "read tier awards" ON public.loyalty_tier_awards AS PERMISSIVE FOR SELECT TO authenticated USING (true)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "admins write tier config" ON public.loyalty_tier_config AS PERMISSIVE FOR ALL TO authenticated USING (is_system_admin(auth.uid())) WITH CHECK (is_system_admin(auth.uid()))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "read tier config" ON public.loyalty_tier_config AS PERMISSIVE FOR SELECT TO authenticated USING (true)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "People manage their own dismissals" ON public.notification_banner_dismissals AS PERMISSIVE FOR ALL TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "Live banners are readable by their audience" ON public.notification_banners AS PERMISSIVE FOR SELECT TO authenticated USING ((is_active AND (starts_at <= now()) AND ((ends_at IS NULL) OR (ends_at > now())) AND ((audience_type = 'all'::text) OR ((audience_type = 'user'::text) AND (auth.uid() = ANY (audience_ids))) OR ((audience_type = 'role'::text) AND (EXISTS ( SELECT 1
   FROM user_profiles up
  WHERE ((up.user_id = auth.uid()) AND (up.profile_id = ANY (notification_banners.audience_ids)))))))))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "Notification admins create banners" ON public.notification_banners AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (user_has_permission(auth.uid(), 'admin_notification_rules'::text, 'can_create'::text))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "Notification admins delete banners" ON public.notification_banners AS PERMISSIVE FOR DELETE TO authenticated USING (user_has_permission(auth.uid(), 'admin_notification_rules'::text, 'can_delete'::text))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "Notification admins edit banners" ON public.notification_banners AS PERMISSIVE FOR UPDATE TO authenticated USING (user_has_permission(auth.uid(), 'admin_notification_rules'::text, 'can_edit'::text)) WITH CHECK (user_has_permission(auth.uid(), 'admin_notification_rules'::text, 'can_edit'::text))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "Notification admins read every banner" ON public.notification_banners AS PERMISSIVE FOR SELECT TO authenticated USING (user_has_permission(auth.uid(), 'admin_notification_rules'::text, 'can_read'::text))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY person_engagement_scores_delete_admin ON public.person_engagement_scores AS PERMISSIVE FOR DELETE TO public USING (is_system_admin(auth.uid()))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY person_engagement_scores_insert_admin ON public.person_engagement_scores AS PERMISSIVE FOR INSERT TO public WITH CHECK (is_system_admin(auth.uid()))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY person_engagement_scores_select_authenticated ON public.person_engagement_scores AS PERMISSIVE FOR SELECT TO public USING ((auth.role() = 'authenticated'::text))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY person_engagement_scores_update_admin ON public.person_engagement_scores AS PERMISSIVE FOR UPDATE TO public USING (is_system_admin(auth.uid()))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY pbe_audit_read ON public.price_book_entry_audit AS PERMISSIVE FOR SELECT TO authenticated USING (user_has_permission(auth.uid(), 'admin_price_book'::text, 'can_read'::text))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY price_book_setup_tasks_insert ON public.price_book_setup_tasks AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (user_has_permission(auth.uid(), 'admin_price_book'::text, 'can_edit'::text))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY price_book_setup_tasks_read ON public.price_book_setup_tasks AS PERMISSIVE FOR SELECT TO authenticated USING (user_has_permission(auth.uid(), 'admin_price_book'::text, 'can_read'::text))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY price_book_setup_tasks_write ON public.price_book_setup_tasks AS PERMISSIVE FOR UPDATE TO authenticated USING (user_has_permission(auth.uid(), 'admin_price_book'::text, 'can_edit'::text)) WITH CHECK (user_has_permission(auth.uid(), 'admin_price_book'::text, 'can_edit'::text))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "Admins can view product audit log" ON public.product_audit_log AS PERMISSIVE FOR SELECT TO public USING ((is_system_admin(auth.uid()) OR user_has_permission(auth.uid(), 'admin_products'::text, 'can_read'::text)))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY audit_insert_service ON public.product_audit_log AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY audit_insert_service ON public.product_price_change_log AS PERMISSIVE FOR INSERT TO public WITH CHECK (true)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY audit_select_admin_only ON public.product_price_change_log AS PERMISSIVE FOR SELECT TO public USING (is_system_admin(auth.uid()))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY qa_custom_tests_auth ON public.qa_custom_tests AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "admins manage tiers" ON public.retailer_loyalty_tiers AS PERMISSIVE FOR ALL TO authenticated USING (is_system_admin(auth.uid())) WITH CHECK (is_system_admin(auth.uid()))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "anyone signed in can read tiers" ON public.retailer_loyalty_tiers AS PERMISSIVE FOR SELECT TO authenticated USING (true)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY scheme_free_product_stock_movements_select ON public.scheme_free_product_stock_movements AS PERMISSIVE FOR SELECT TO public USING (user_has_permission(auth.uid(), 'module_schemes'::text, 'can_read'::text))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY scheme_free_products_anon_read_active ON public.scheme_free_products AS PERMISSIVE FOR SELECT TO anon USING ((is_active = true))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY scheme_free_products_authenticated_read_active ON public.scheme_free_products AS PERMISSIVE FOR SELECT TO authenticated USING ((is_active = true))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY scheme_free_products_delete ON public.scheme_free_products AS PERMISSIVE FOR DELETE TO public USING (user_has_permission(auth.uid(), 'action_scheme_delete'::text, 'can_delete'::text))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY scheme_free_products_insert ON public.scheme_free_products AS PERMISSIVE FOR INSERT TO public WITH CHECK (user_has_permission(auth.uid(), 'action_scheme_create'::text, 'can_create'::text))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY scheme_free_products_select ON public.scheme_free_products AS PERMISSIVE FOR SELECT TO public USING (user_has_permission(auth.uid(), 'module_schemes'::text, 'can_read'::text))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY scheme_free_products_update ON public.scheme_free_products AS PERMISSIVE FOR UPDATE TO public USING (user_has_permission(auth.uid(), 'action_scheme_edit'::text, 'can_edit'::text)) WITH CHECK (user_has_permission(auth.uid(), 'action_scheme_edit'::text, 'can_edit'::text))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY user_distributors_select ON public.user_distributors AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() IS NOT NULL))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY user_distributors_write ON public.user_distributors AS PERMISSIVE FOR ALL TO public USING (user_has_permission(auth.uid(), 'module_user_management'::text, 'can_edit'::text)) WITH CHECK (user_has_permission(auth.uid(), 'module_user_management'::text, 'can_edit'::text))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "amend van expenses" ON public.van_expenses AS PERMISSIVE FOR UPDATE TO authenticated USING (((recorded_by = auth.uid()) OR is_admin_or_manager())) WITH CHECK (((recorded_by = auth.uid()) OR is_admin_or_manager()))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "read van expenses" ON public.van_expenses AS PERMISSIVE FOR SELECT TO authenticated USING (true)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "record van expenses" ON public.van_expenses AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((auth.uid() IS NOT NULL))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "remove van expenses" ON public.van_expenses AS PERMISSIVE FOR DELETE TO authenticated USING (((recorded_by = auth.uid()) OR is_admin_or_manager()))$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "read odometer" ON public.van_odometer_readings AS PERMISSIVE FOR SELECT TO authenticated USING (true)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "manage service schedule" ON public.van_service_schedule AS PERMISSIVE FOR ALL TO authenticated USING (is_admin_or_manager()) WITH CHECK (is_admin_or_manager())$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE POLICY "read service schedule" ON public.van_service_schedule AS PERMISSIVE FOR SELECT TO authenticated USING (true)$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE TRIGGER trg_feedback_protect_builtin BEFORE DELETE OR UPDATE ON feedback_module_config FOR EACH ROW EXECUTE FUNCTION feedback_protect_builtin_module()$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE TRIGGER notification_banners_set_updated_at BEFORE UPDATE ON notification_banners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE TRIGGER set_updated_at BEFORE UPDATE ON person_engagement_scores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE TRIGGER price_book_setup_tasks_touch BEFORE UPDATE ON price_book_setup_tasks FOR EACH ROW EXECUTE FUNCTION price_book_setup_tasks_touch()$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE TRIGGER trg_guard_locked_tiers BEFORE INSERT OR DELETE OR UPDATE ON retailer_loyalty_tiers FOR EACH ROW EXECUTE FUNCTION tg_guard_locked_tiers()$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE TRIGGER set_scheme_free_products_updated_at BEFORE UPDATE ON scheme_free_products FOR EACH ROW EXECUTE FUNCTION set_updated_at()$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
DO $mx$ BEGIN EXECUTE $q$CREATE TRIGGER trg_van_sync_odometer AFTER INSERT ON van_odometer_readings FOR EACH ROW EXECUTE FUNCTION tg_van_sync_odometer()$q$; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'skip: %', SQLERRM; END $mx$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.distributor_invoice_settings TO authenticated; GRANT ALL ON public.distributor_invoice_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_counters TO authenticated; GRANT ALL ON public.document_counters TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exchange_rates TO authenticated; GRANT ALL ON public.exchange_rates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback_module_config TO authenticated; GRANT ALL ON public.feedback_module_config TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback_responses TO authenticated; GRANT ALL ON public.feedback_responses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_api_config TO authenticated; GRANT ALL ON public.fleet_api_config TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_api_log TO authenticated; GRANT ALL ON public.fleet_api_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_generation_failures TO authenticated; GRANT ALL ON public.invoice_generation_failures TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_tier_awards TO authenticated; GRANT ALL ON public.loyalty_tier_awards TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_tier_config TO authenticated; GRANT ALL ON public.loyalty_tier_config TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_banner_dismissals TO authenticated; GRANT ALL ON public.notification_banner_dismissals TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_banners TO authenticated; GRANT ALL ON public.notification_banners TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_engagement_scores TO authenticated; GRANT ALL ON public.person_engagement_scores TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_book_entry_audit TO authenticated; GRANT ALL ON public.price_book_entry_audit TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_book_setup_tasks TO authenticated; GRANT ALL ON public.price_book_setup_tasks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_audit_log TO authenticated; GRANT ALL ON public.product_audit_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_mrp_overrides TO authenticated; GRANT ALL ON public.product_mrp_overrides TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_price_change_log TO authenticated; GRANT ALL ON public.product_price_change_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_custom_tests TO authenticated; GRANT ALL ON public.qa_custom_tests TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.retailer_loyalty_tiers TO authenticated; GRANT ALL ON public.retailer_loyalty_tiers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheme_free_product_stock_movements TO authenticated; GRANT ALL ON public.scheme_free_product_stock_movements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheme_free_products TO authenticated; GRANT ALL ON public.scheme_free_products TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_distributors TO authenticated; GRANT ALL ON public.user_distributors TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.van_expenses TO authenticated; GRANT ALL ON public.van_expenses TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.van_odometer_readings TO authenticated; GRANT ALL ON public.van_odometer_readings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.van_service_schedule TO authenticated; GRANT ALL ON public.van_service_schedule TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

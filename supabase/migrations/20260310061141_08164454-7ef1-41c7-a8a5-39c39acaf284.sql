
-- Fix orders notification trigger: order_number doesn't exist, use invoice_number
CREATE OR REPLACE FUNCTION public.trigger_notification_orders()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM emit_notification_event('RECORD_CREATED', 'orders', NEW.id::text, NEW.user_id,
      jsonb_build_object('record_name', COALESCE(NEW.invoice_number, NEW.id::text), 'date', NEW.order_date::text));
  ELSIF TG_OP = 'UPDATE' AND NEW.status != OLD.status THEN
    IF NEW.status = 'confirmed' THEN
      PERFORM emit_notification_event('RECORD_APPROVED', 'orders', NEW.id::text, NEW.user_id,
        jsonb_build_object('record_name', COALESCE(NEW.invoice_number, NEW.id::text), 'date', NEW.order_date::text));
    ELSE
      PERFORM emit_notification_event('RECORD_UPDATED', 'orders', NEW.id::text, NEW.user_id,
        jsonb_build_object('record_name', COALESCE(NEW.invoice_number, NEW.id::text), 'date', NEW.order_date::text));
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix visits notification trigger: retailer_name doesn't exist on visits, look it up from retailers table
CREATE OR REPLACE FUNCTION public.trigger_notification_visits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_retailer_name text;
BEGIN
  -- Look up retailer name from retailers table
  SELECT name INTO v_retailer_name FROM public.retailers WHERE id = NEW.retailer_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM emit_notification_event('RECORD_CREATED', 'visits', NEW.id::text, NEW.user_id,
      jsonb_build_object('record_name', COALESCE(v_retailer_name, 'Visit'), 'date', NEW.planned_date::text));
  ELSIF TG_OP = 'UPDATE' AND NEW.status != OLD.status THEN
    IF NEW.status = 'productive' THEN
      PERFORM emit_notification_event('ACTIVITY_COMPLETED', 'visits', NEW.id::text, NEW.user_id,
        jsonb_build_object('record_name', COALESCE(v_retailer_name, 'Visit'), 'date', NEW.planned_date::text));
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

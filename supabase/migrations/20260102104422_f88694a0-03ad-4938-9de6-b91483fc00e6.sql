-- Fix auto_update_visit_status_on_order trigger to handle NULL visit_id
-- When visit_id is NULL, find the most recent visit for the retailer/user/date and update it

CREATE OR REPLACE FUNCTION public.auto_update_visit_status_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_visit_id UUID;
BEGIN
  -- Only process confirmed orders
  IF NEW.status = 'confirmed' THEN
    -- First try to use the provided visit_id
    target_visit_id := NEW.visit_id;
    
    -- If no visit_id provided, find the most recent visit for this retailer today
    IF target_visit_id IS NULL AND NEW.retailer_id IS NOT NULL AND NEW.user_id IS NOT NULL THEN
      SELECT id INTO target_visit_id
      FROM visits
      WHERE retailer_id = NEW.retailer_id
        AND user_id = NEW.user_id
        AND planned_date = NEW.order_date
        AND status IN ('planned', 'in-progress', 'unproductive')
      ORDER BY created_at DESC
      LIMIT 1;
      
      -- Log for debugging
      RAISE LOG 'auto_update_visit_status_on_order: order % has NULL visit_id, found visit %', NEW.id, target_visit_id;
    END IF;
    
    -- Update the visit if found
    IF target_visit_id IS NOT NULL THEN
      UPDATE visits
      SET 
        status = 'productive',
        check_out_time = COALESCE(check_out_time, NEW.created_at),
        no_order_reason = NULL,
        updated_at = NOW()
      WHERE id = target_visit_id
        AND status IN ('planned', 'in-progress', 'unproductive');
        
      RAISE LOG 'auto_update_visit_status_on_order: updated visit % to productive', target_visit_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
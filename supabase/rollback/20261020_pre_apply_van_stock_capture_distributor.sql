-- SNAPSHOT taken 2026-10-20, immediately before applying
-- 20261020140000_van_day_requires_distributor.sql to staging.
--
-- This is the definition that was live at that moment, captured with
-- pg_get_functiondef. md5 2262a768d0245638dbd85eb9626bbf40.
--
-- To roll the migration back, run this file. It restores the previous
-- behaviour exactly: copy the van's distributor when none was supplied, and
-- leave distributor_id NULL if the van has none.
--
-- Not a migration. Kept out of supabase/migrations deliberately so it is never
-- replayed as part of a normal deploy.

CREATE OR REPLACE FUNCTION public.van_stock_capture_distributor()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.distributor_id IS NULL THEN
    SELECT v.distributor_id INTO NEW.distributor_id
    FROM public.vans v WHERE v.id = NEW.van_id;
  END IF;
  RETURN NEW;
END;
$function$;

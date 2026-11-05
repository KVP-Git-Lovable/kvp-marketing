-- A van day that carries no distributor can never be settled: dms_settle_van_day
-- returns 'van_has_no_distributor' and stops. Ten such rows exist in staging.
-- They are dev test records and are deliberately left exactly as they are.
--
-- The stamping trigger already does the right thing for new rows — it copies
-- vans.distributor_id when none is given — and it fires BEFORE INSERT only.
-- That INSERT-only scope is deliberate and is kept: extending it to UPDATE
-- would silently restore a distributor on those ten historical rows the moment
-- anything touched them, which is precisely what must not happen. A removed
-- association stays removed.
--
-- The one gap is a van that has no distributor of its own. Today the trigger
-- leaves NEW.distributor_id NULL and a van day is created that looks ordinary
-- and can never post. This makes that refusal explicit at the point of
-- creation, where it can still be acted on, instead of surfacing days or weeks
-- later as an unexplained settlement failure.
--
-- Behaviour change: creating a van day for a van with no distributor now
-- raises. No van is currently in that state (1 van, linked), so nothing in
-- staging is affected — but it is a hard refusal and worth knowing about.

create or replace function public.van_stock_capture_distributor()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_van_distributor uuid;
  v_van_label       text;
BEGIN
  -- An explicitly supplied distributor is honoured and never second-guessed.
  IF NEW.distributor_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT v.distributor_id, coalesce(v.registration_number, v.id::text)
    INTO v_van_distributor, v_van_label
  FROM public.vans v
  WHERE v.id = NEW.van_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot create a van day: van % does not exist.', NEW.van_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_van_distributor IS NULL THEN
    RAISE EXCEPTION
      'Cannot create a van day for van %: it is not linked to a distributor, so its stock could never be settled. Link the van to a distributor first.',
      v_van_label
      USING ERRCODE = 'not_null_violation';
  END IF;

  NEW.distributor_id := v_van_distributor;
  RETURN NEW;
END;
$function$;

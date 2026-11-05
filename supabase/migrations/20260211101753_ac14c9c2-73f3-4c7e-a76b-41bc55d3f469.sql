
-- Auto-set tenant_id on retailer insert from the user's profile
CREATE OR REPLACE FUNCTION public.set_retailer_tenant_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM public.profiles
    WHERE id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_retailer_tenant_id
BEFORE INSERT ON public.retailers
FOR EACH ROW
EXECUTE FUNCTION public.set_retailer_tenant_id();

-- Also backfill any existing retailers missing tenant_id
UPDATE public.retailers r
SET tenant_id = p.tenant_id
FROM public.profiles p
WHERE r.user_id = p.id
  AND r.tenant_id IS NULL
  AND p.tenant_id IS NOT NULL;

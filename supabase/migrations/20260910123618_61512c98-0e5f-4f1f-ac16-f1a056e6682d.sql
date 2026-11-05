CREATE TABLE IF NOT EXISTS public.invoice_compression_lock (
  key INTEGER NOT NULL PRIMARY KEY,
  locked_at TIMESTAMPTZ
);

GRANT ALL ON public.invoice_compression_lock TO service_role;
ALTER TABLE public.invoice_compression_lock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct client access to compression lock" ON public.invoice_compression_lock;
CREATE POLICY "No direct client access to compression lock"
ON public.invoice_compression_lock FOR SELECT TO authenticated USING (false);

CREATE OR REPLACE FUNCTION public.try_invoice_compression_lock(p_key INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked_at TIMESTAMPTZ;
BEGIN
  INSERT INTO public.invoice_compression_lock (key, locked_at)
  VALUES (p_key, NULL)
  ON CONFLICT (key) DO NOTHING;

  SELECT locked_at INTO v_locked_at
  FROM public.invoice_compression_lock
  WHERE key = p_key
  FOR UPDATE;

  IF v_locked_at IS NOT NULL AND v_locked_at > now() - INTERVAL '10 minutes' THEN
    RETURN FALSE;
  END IF;

  UPDATE public.invoice_compression_lock SET locked_at = now() WHERE key = p_key;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_invoice_compression_lock(p_key INTEGER)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.invoice_compression_lock SET locked_at = NULL WHERE key = p_key;
$$;

REVOKE ALL ON FUNCTION public.try_invoice_compression_lock(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_invoice_compression_lock(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_invoice_compression_lock(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_invoice_compression_lock(INTEGER) TO service_role;
CREATE TABLE IF NOT EXISTS public.invoice_compression_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_path TEXT NOT NULL UNIQUE,
  original_size_bytes BIGINT,
  compressed_size_bytes BIGINT,
  saved_bytes BIGINT,
  backup_path TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invoice_compression_logs_status_check CHECK (status IN ('COMPRESSED','SKIPPED_NOT_SMALLER','FAILED_VALIDATION','ERROR'))
);

GRANT SELECT ON public.invoice_compression_logs TO authenticated;
GRANT ALL ON public.invoice_compression_logs TO service_role;

ALTER TABLE public.invoice_compression_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view compression logs" ON public.invoice_compression_logs;
CREATE POLICY "Authenticated can view compression logs"
ON public.invoice_compression_logs FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.list_invoice_files_in_range(
  p_from DATE,
  p_to DATE
)
RETURNS TABLE (file_path TEXT, size_bytes BIGINT, created_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT o.name::text,
         COALESCE((o.metadata->>'size')::bigint, 0),
         o.created_at
  FROM storage.objects o
  WHERE o.bucket_id = 'invoices'
    AND o.created_at >= p_from::timestamptz
    AND o.created_at < (p_to + INTERVAL '1 day')
  ORDER BY o.name
$$;

REVOKE ALL ON FUNCTION public.list_invoice_files_in_range(DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_invoice_files_in_range(DATE, DATE) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_invoice_compression_candidates(
  p_from DATE,
  p_to DATE,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (file_path TEXT, size_bytes BIGINT, total_remaining BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  WITH eligible AS (
    SELECT o.name::text AS file_path,
           COALESCE((o.metadata->>'size')::bigint, 0) AS size_bytes
    FROM storage.objects o
    WHERE o.bucket_id = 'invoices'
      AND o.created_at >= p_from::timestamptz
      AND o.created_at < (p_to + INTERVAL '1 day')
      AND COALESCE((o.metadata->>'size')::bigint, 0) > 307200
      AND NOT EXISTS (
        SELECT 1 FROM public.invoice_compression_logs l
        WHERE l.file_path = o.name
          AND l.status IN ('COMPRESSED','SKIPPED_NOT_SMALLER')
      )
  )
  SELECT e.file_path, e.size_bytes, (SELECT count(*) FROM eligible)::bigint
  FROM eligible e
  ORDER BY e.file_path
  LIMIT GREATEST(p_limit, 1)
$$;

REVOKE ALL ON FUNCTION public.get_invoice_compression_candidates(DATE, DATE, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invoice_compression_candidates(DATE, DATE, INTEGER) TO authenticated, service_role;
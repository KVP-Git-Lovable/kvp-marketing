CREATE OR REPLACE FUNCTION public.get_estimated_memory_usage()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  WITH active_queries AS (
    SELECT COUNT(*) AS active_count
    FROM pg_stat_activity
    WHERE state != 'idle'
  ),
  settings AS (
    SELECT
      pg_size_bytes(current_setting('shared_buffers')) AS shared_buffers_bytes,
      pg_size_bytes(current_setting('work_mem')) AS work_mem_bytes
  )
  SELECT jsonb_build_object(
    'estimated_memory_usage_percent', ROUND(
      ((shared_buffers_bytes + (work_mem_bytes * active_count))
       / (1024 * 1024 * 1024.0)
      ) * 100, 2
    ),
    'shared_buffers', pg_size_pretty(shared_buffers_bytes),
    'work_mem_total', pg_size_pretty(work_mem_bytes * active_count),
    'active_queries', active_count
  ) INTO result
  FROM settings, active_queries;

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_database_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Only allow System Administrators
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: System Administrator required';
  END IF;

  SELECT jsonb_build_object(
    'db_size_bytes', pg_database_size(current_database()),
    'uptime_seconds', EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time())),
    'postmaster_start_time', pg_postmaster_start_time(),
    'active_connections', (SELECT count(*) FROM pg_stat_activity WHERE state = 'active'),
    'total_connections', (SELECT count(*) FROM pg_stat_activity),
    'idle_connections', (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle'),
    'cache_hit_ratio', (
      SELECT ROUND(
        COALESCE(sum(blks_hit)::numeric / NULLIF(sum(blks_hit) + sum(blks_read), 0) * 100, 0), 2
      ) FROM pg_stat_database WHERE datname = current_database()
    ),
    'total_transactions', (
      SELECT COALESCE(xact_commit + xact_rollback, 0) FROM pg_stat_database WHERE datname = current_database()
    ),
    'commits', (SELECT COALESCE(xact_commit, 0) FROM pg_stat_database WHERE datname = current_database()),
    'rollbacks', (SELECT COALESCE(xact_rollback, 0) FROM pg_stat_database WHERE datname = current_database()),
    'rows_read', (SELECT COALESCE(tup_returned, 0) FROM pg_stat_database WHERE datname = current_database()),
    'rows_inserted', (SELECT COALESCE(tup_inserted, 0) FROM pg_stat_database WHERE datname = current_database()),
    'rows_updated', (SELECT COALESCE(tup_updated, 0) FROM pg_stat_database WHERE datname = current_database()),
    'rows_deleted', (SELECT COALESCE(tup_deleted, 0) FROM pg_stat_database WHERE datname = current_database()),
    'deadlocks', (SELECT COALESCE(deadlocks, 0) FROM pg_stat_database WHERE datname = current_database()),
    'temp_files', (SELECT COALESCE(temp_files, 0) FROM pg_stat_database WHERE datname = current_database()),
    'blks_read', (SELECT COALESCE(blks_read, 0) FROM pg_stat_database WHERE datname = current_database()),
    'blks_hit', (SELECT COALESCE(blks_hit, 0) FROM pg_stat_database WHERE datname = current_database()),
    'total_table_count', (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'),
    'db_name', current_database()
  ) INTO result;

  RETURN result;
END;
$$;


-- Table: user_sessions
CREATE TABLE public.user_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  login_at timestamptz DEFAULT now(),
  logout_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_login_at ON public.user_sessions(login_at);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own sessions"
  ON public.user_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON public.user_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all sessions"
  ON public.user_sessions FOR SELECT TO authenticated
  USING (public.is_system_admin(auth.uid()));

CREATE POLICY "Users can view own sessions"
  ON public.user_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Table: user_page_views
CREATE TABLE public.user_page_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid REFERENCES public.user_sessions(id) ON DELETE CASCADE,
  page_path text NOT NULL,
  module_name text NOT NULL,
  visited_at timestamptz DEFAULT now(),
  duration_seconds integer
);

CREATE INDEX idx_user_page_views_user_id ON public.user_page_views(user_id);
CREATE INDEX idx_user_page_views_session_id ON public.user_page_views(session_id);
CREATE INDEX idx_user_page_views_visited_at ON public.user_page_views(visited_at);

ALTER TABLE public.user_page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own page views"
  ON public.user_page_views FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own page views"
  ON public.user_page_views FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all page views"
  ON public.user_page_views FOR SELECT TO authenticated
  USING (public.is_system_admin(auth.uid()));

-- Table: user_data_usage
CREATE TABLE public.user_data_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid REFERENCES public.user_sessions(id) ON DELETE CASCADE,
  bytes_uploaded bigint DEFAULT 0,
  bytes_downloaded bigint DEFAULT 0,
  recorded_at timestamptz DEFAULT now()
);

CREATE INDEX idx_user_data_usage_user_id ON public.user_data_usage(user_id);
CREATE INDEX idx_user_data_usage_session_id ON public.user_data_usage(session_id);

ALTER TABLE public.user_data_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own data usage"
  ON public.user_data_usage FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all data usage"
  ON public.user_data_usage FOR SELECT TO authenticated
  USING (public.is_system_admin(auth.uid()));

-- Grant permissions (following project's permissive model)
GRANT ALL ON public.user_sessions TO authenticated, anon;
GRANT ALL ON public.user_page_views TO authenticated, anon;
GRANT ALL ON public.user_data_usage TO authenticated, anon;

-- RPC: get_activity_logging_summary
CREATE OR REPLACE FUNCTION public.get_activity_logging_summary(p_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_system_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: System Administrator required';
  END IF;

  SELECT jsonb_agg(row_data) INTO result
  FROM (
    SELECT jsonb_build_object(
      'user_id', p.id,
      'full_name', COALESCE(p.full_name, p.username, 'Unknown'),
      'total_usage_seconds', COALESCE(sess.total_seconds, 0),
      'most_used_module', COALESCE(most.module_name, '-'),
      'most_used_count', COALESCE(most.visit_count, 0),
      'least_used_module', COALESCE(least.module_name, '-'),
      'least_used_count', COALESCE(least.visit_count, 0),
      'data_usage_bytes', COALESCE(du.total_bytes, 0)
    ) as row_data
    FROM public.profiles p
    INNER JOIN (
      SELECT user_id, SUM(
        EXTRACT(EPOCH FROM (COALESCE(logout_at, now()) - login_at))
      )::bigint as total_seconds
      FROM public.user_sessions
      WHERE login_at >= now() - (p_days || ' days')::interval
      GROUP BY user_id
    ) sess ON sess.user_id = p.id
    LEFT JOIN LATERAL (
      SELECT module_name, COUNT(*)::integer as visit_count
      FROM public.user_page_views
      WHERE user_id = p.id AND visited_at >= now() - (p_days || ' days')::interval
      GROUP BY module_name
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) most ON true
    LEFT JOIN LATERAL (
      SELECT module_name, COUNT(*)::integer as visit_count
      FROM public.user_page_views
      WHERE user_id = p.id AND visited_at >= now() - (p_days || ' days')::interval
      GROUP BY module_name
      ORDER BY COUNT(*) ASC
      LIMIT 1
    ) least ON true
    LEFT JOIN (
      SELECT user_id, SUM(bytes_uploaded + bytes_downloaded)::bigint as total_bytes
      FROM public.user_data_usage
      WHERE recorded_at >= now() - (p_days || ' days')::interval
      GROUP BY user_id
    ) du ON du.user_id = p.id
    ORDER BY sess.total_seconds DESC
  ) sub;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

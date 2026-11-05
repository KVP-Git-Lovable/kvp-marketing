-- Postgres grants EXECUTE to PUBLIC on new functions, and `anon` inherits it,
-- so these were callable with the publishable key (which ships in the client
-- bundle) without signing in. Rankings are colleague data; require a session.
REVOKE ALL ON FUNCTION public.gam_rankings(timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gam_person_programs(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gam_can_view_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gam_person_detail(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.gam_rankings(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gam_person_programs(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gam_can_view_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gam_person_detail(uuid, timestamptz, timestamptz) TO authenticated;

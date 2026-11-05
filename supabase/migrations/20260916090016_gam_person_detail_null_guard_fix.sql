-- Per-award detail, gated to yourself and to people who report to you.
--
-- SECURITY: report_can_view_user(NULL, target) returns NULL, not false:
--   NULL = target  ->  NULL
--   NULL OR false  ->  NULL
-- and `IF NOT NULL THEN` does not branch, so a naive guard falls through and
-- returns full award detail (retailer names, order values) to a caller with no
-- auth.uid(). Treat a NULL permission answer as a refusal, and refuse an
-- unauthenticated caller outright.

CREATE OR REPLACE FUNCTION public.gam_can_view_detail(p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL
     AND COALESCE(public.report_can_view_user(auth.uid(), p_user), false);
$$;

CREATE OR REPLACE FUNCTION public.gam_person_detail(p_user uuid, p_from timestamptz, p_to timestamptz)
RETURNS TABLE(id uuid, earned_at timestamptz, points numeric, program text, category text,
              activity text, reference_type text, retailer_name text,
              order_value numeric, order_status text, beat_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF p_user IS NULL
     OR auth.uid() IS NULL
     OR NOT COALESCE(public.report_can_view_user(auth.uid(), p_user), false) THEN
    RAISE EXCEPTION 'Not authorised to view award detail for this user'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT e.id, e.earned_at, e.points,
         g.name AS program, g.category, ga.action_name AS activity,
         e.reference_type,
         COALESCE(o.retailer_name, r.name) AS retailer_name,
         o.total_amount AS order_value, o.status AS order_status, r.beat_name
  FROM public.gam_eligible_points(p_from, p_to) e
  JOIN gamification_games g ON g.id = e.game_id
  JOIN gamification_actions ga ON ga.id = e.action_id
  LEFT JOIN orders o ON o.id = e.reference_id
  LEFT JOIN retailers r ON r.id = e.retailer_id
  WHERE e.user_id = p_user
  ORDER BY e.earned_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gam_can_view_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gam_person_detail(uuid, timestamptz, timestamptz) TO authenticated;

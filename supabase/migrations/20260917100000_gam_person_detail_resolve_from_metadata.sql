-- The awarding code does not fill gamification_points.retailer_id consistently,
-- and for "Productive visit" it writes reference_type = 'order' while
-- reference_id actually holds a RETAILER id — so the join to orders finds
-- nothing and the row rendered as "No order / No retailer" even though the
-- metadata carried both. Measured over the whole ledger, falling back to
-- metadata lifts retailer resolution on that activity from 0/126 to 120/126
-- and order value from 0 to 121.
--
-- Also returns trigger_type and the target-tier metadata so the UI can show the
-- right detail per activity instead of one generic shape.
-- The return type changes, so the old signature has to go first.
DROP FUNCTION IF EXISTS public.gam_person_detail(uuid, timestamptz, timestamptz);

CREATE FUNCTION public.gam_person_detail(p_user uuid, p_from timestamptz, p_to timestamptz)
RETURNS TABLE(id uuid, earned_at timestamptz, points numeric, program text, category text,
              activity text, trigger_type text, reference_type text,
              retailer_name text, beat_name text,
              order_value numeric, order_status text,
              period_key text, tier_pct numeric, achievement_pct numeric)
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
  WITH src AS (
    SELECT e.id AS eid, e.earned_at AS eat, e.points AS pts,
           e.game_id, e.action_id, e.reference_id, e.reference_type AS rtype,
           gp.metadata, gp.period_key AS pkey,
           COALESCE(
             e.retailer_id,
             NULLIF(gp.metadata->>'retailer_id','')::uuid,
             NULLIF(gp.metadata->'context'->>'retailer_id','')::uuid
           ) AS rid
    FROM public.gam_eligible_points(p_from, p_to) e
    JOIN gamification_points gp ON gp.id = e.id
    WHERE e.user_id = p_user
  )
  SELECT s.eid, s.eat, s.pts,
         g.name, g.category, ga.action_name,
         ga.trigger_type, s.rtype,
         COALESCE(o.retailer_name, r.name),
         r.beat_name,
         COALESCE(o.total_amount,
                  NULLIF(s.metadata->>'order_value','')::numeric,
                  NULLIF(s.metadata->'context'->>'order_value','')::numeric),
         o.status,
         s.pkey,
         NULLIF(s.metadata->>'tier_threshold','')::numeric,
         NULLIF(s.metadata->>'achievement_percent','')::numeric
  FROM src s
  JOIN gamification_games g ON g.id = s.game_id
  JOIN gamification_actions ga ON ga.id = s.action_id
  LEFT JOIN orders o ON o.id = s.reference_id
  LEFT JOIN retailers r ON r.id = s.rid
  ORDER BY s.eat DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.gam_person_detail(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gam_person_detail(uuid, timestamptz, timestamptz) TO authenticated;

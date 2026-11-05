-- The award drawer's "View order" button had nothing to navigate to: the rpc
-- already joins orders and retailers to read their names, but never returned
-- their ids. Both are added at the end of the row, so nothing that reads the
-- existing columns by name changes.
--
-- order_id is null whenever reference_id is not really an order — Productive
-- visit records reference_type 'order' against a RETAILER id, 125 awards of
-- them — so the caller can fall back to the retailer instead of offering a
-- link that goes nowhere.
--
-- The return type changes, so this is a drop and create; the grants are put
-- back exactly as they were (authenticated only, never anon or PUBLIC).
drop function if exists public.gam_person_detail(uuid, timestamptz, timestamptz);

create function public.gam_person_detail(
  p_user uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  id uuid,
  earned_at timestamptz,
  points numeric,
  program text,
  category text,
  activity text,
  trigger_type text,
  reference_type text,
  retailer_name text,
  beat_name text,
  order_value numeric,
  order_status text,
  period_key text,
  tier_pct numeric,
  achievement_pct numeric,
  order_id uuid,
  retailer_id uuid
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
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
         NULLIF(s.metadata->>'achievement_percent','')::numeric,
         o.id,
         s.rid
  FROM src s
  JOIN gamification_games g ON g.id = s.game_id
  JOIN gamification_actions ga ON ga.id = s.action_id
  LEFT JOIN orders o ON o.id = s.reference_id
  LEFT JOIN retailers r ON r.id = s.rid
  ORDER BY s.eat DESC;
END;
$function$;

revoke all on function public.gam_person_detail(uuid, timestamptz, timestamptz) from public;
grant execute on function public.gam_person_detail(uuid, timestamptz, timestamptz) to authenticated;

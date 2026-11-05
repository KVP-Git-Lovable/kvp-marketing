-- The records level of the admin drill-down.
--
-- The Overview could show you that Abhishek earned 375 from Target rewards and
-- then stopped: the dialog had no level below the summary, so "which awards are
-- those, and why does a six-rung game net 375?" was unanswerable without a SQL
-- client. This returns the individual awards behind exactly one (game, person)
-- cell of gamification_points_rollup, and — given p_id — one award on its own,
-- which is what a Points-ledger row now opens.
--
-- It deliberately reads gamification_points on the SAME basis as
-- gamification_points_rollup: the raw table, every status, no leaderboard or
-- expiry filter, and the identical half-open window predicate. Using
-- gam_eligible_points here instead would have been the obvious choice and the
-- wrong one — it drops expired, non-leaderboard and NULL-user awards, so the
-- records would not have summed to the total sitting directly above them.
--
-- IS NOT DISTINCT FROM, not =, because the Overview has real rows for "not
-- linked to a game" and "not linked to a person". Those buckets are cells of
-- the roll-up like any other and drill like any other.
--
-- WHO SEES WHAT. The rows themselves are open to any signed-in caller, because
-- gamification_points already is (policy "All authenticated users can view
-- points") and /gamification-admin carries no role gate — gating the rows would
-- put a dead end in front of the very people the page already serves. What is
-- gated is the ENRICHMENT: retailer, beat, order value, order status and the
-- ids that link to them are joined from RLS'd tables, and are returned only to
-- an admin, or to someone already entitled to that person's detail. This is the
-- same line gam_person_detail draws; this function must not become a way around
-- it.
create or replace function public.gam_admin_award_records(
  p_game uuid default null,
  p_user uuid default null,
  p_from date default null,
  p_to   date default null,
  p_id   uuid default null
)
returns table (
  id uuid,
  earned_at timestamptz,
  points numeric,
  user_id uuid,
  person text,
  game_id uuid,
  program text,
  category text,
  activity text,
  trigger_type text,
  reference_type text,
  status text,
  expires_at timestamptz,
  period_key text,
  tier_pct numeric,
  achievement_pct numeric,
  retailer_name text,
  beat_name text,
  order_value numeric,
  order_status text,
  order_id uuid,
  retailer_id uuid
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
DECLARE
  v_admin boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorised to view award records'
      USING ERRCODE = '42501';
  END IF;

  v_admin := COALESCE(public.is_admin_or_manager(), false);

  RETURN QUERY
  WITH src AS (
    SELECT gp.id AS eid, gp.earned_at AS eat, gp.points AS pts,
           gp.user_id AS uid, gp.game_id AS gid, gp.action_id,
           gp.reference_id, gp.reference_type AS rtype,
           gp.status AS st, gp.expires_at AS exp,
           gp.metadata, gp.period_key AS pkey,
           -- A Productive visit's reference_type says "order" but its
           -- reference_id is a RETAILER, so the retailer is resolved from the
           -- column and the metadata rather than from reference_id.
           COALESCE(
             gp.retailer_id,
             NULLIF(gp.metadata->>'retailer_id','')::uuid,
             NULLIF(gp.metadata->'context'->>'retailer_id','')::uuid
           ) AS rid,
           -- Entitlement is per row: an ordinary manager drilling this page
           -- sees their own reports whole and everyone else redacted.
           (v_admin OR COALESCE(public.report_can_view_user(auth.uid(), gp.user_id), false)) AS full_view
    FROM gamification_points gp
    WHERE
      CASE WHEN p_id IS NOT NULL THEN gp.id = p_id
      ELSE
            gp.game_id IS NOT DISTINCT FROM p_game
        AND gp.user_id IS NOT DISTINCT FROM p_user
        AND (p_from IS NULL OR gp.earned_at >= p_from::timestamptz)
        AND (p_to   IS NULL OR gp.earned_at <  (p_to + 1)::timestamptz)
      END
  )
  SELECT s.eid, s.eat, s.pts,
         s.uid,
         COALESCE(pr.full_name, pr.username, 'Unknown user')::text,
         s.gid,
         g.name, g.category, ga.action_name,
         ga.trigger_type, s.rtype,
         s.st, s.exp, s.pkey,
         NULLIF(s.metadata->>'tier_threshold','')::numeric,
         NULLIF(s.metadata->>'achievement_percent','')::numeric,
         CASE WHEN s.full_view THEN COALESCE(o.retailer_name, r.name) END,
         CASE WHEN s.full_view THEN r.beat_name END,
         CASE WHEN s.full_view THEN COALESCE(o.total_amount,
                  NULLIF(s.metadata->>'order_value','')::numeric,
                  NULLIF(s.metadata->'context'->>'order_value','')::numeric) END,
         CASE WHEN s.full_view THEN o.status END,
         CASE WHEN s.full_view THEN o.id END,
         CASE WHEN s.full_view THEN s.rid END
  FROM src s
  -- LEFT, not INNER: an award whose game or person was deleted still has to
  -- appear, because the roll-up cell above it still counts its points.
  LEFT JOIN gamification_games g ON g.id = s.gid
  LEFT JOIN gamification_actions ga ON ga.id = s.action_id
  LEFT JOIN profiles pr ON pr.id = s.uid
  LEFT JOIN orders o ON o.id = s.reference_id
  LEFT JOIN retailers r ON r.id = s.rid
  ORDER BY s.eat DESC;
END;
$function$;

revoke all on function public.gam_admin_award_records(uuid, uuid, date, date, uuid) from public;
grant execute on function public.gam_admin_award_records(uuid, uuid, date, date, uuid) to authenticated;

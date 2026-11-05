-- Say "you may not see this", never "there is nothing to see".
--
-- gam_admin_award_records nulls the retailer, order and their ids for a caller
-- who is not an admin and not entitled to that person's detail. The record
-- panel then has to explain why nothing is linked, and it decided from what
-- survived: a row with a period_key and no ids was described as settling
-- against a period with no shop or order behind it.
--
-- For a REDACTED order award that sentence is simply untrue. Abhishek's "First
-- order from new retailer" rows carry period_key 2026-09 and a real order; a
-- peer viewing them was told the order did not exist. Absence of permission and
-- absence of data are different facts and must not render as the same one.
--
-- So the function now states which it is. The flag is the same predicate that
-- drives the nulling, returned rather than inferred, because any inference the
-- client makes from reference_type is a guess that a deleted order breaks.
--
-- Return type changes, so the function is dropped rather than replaced.
drop function if exists public.gam_admin_award_records(uuid, uuid, date, date, uuid);

create function public.gam_admin_award_records(
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
  retailer_id uuid,
  -- True when the customer detail above was withheld from this caller. The
  -- points, person, game and dates are never withheld: the totals they roll up
  -- into are already on the page that linked here.
  redacted boolean
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
         CASE WHEN s.full_view THEN s.rid END,
         -- Only claim redaction when something was actually held back. An award
         -- with no retailer and no order — a target tier — is not redacted for
         -- anyone, and saying it was would be its own small lie.
         (NOT s.full_view) AND (s.rid IS NOT NULL OR o.id IS NOT NULL)
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

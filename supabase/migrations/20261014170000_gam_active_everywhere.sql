-- One definition of "active", applied to every gamification surface that lists
-- or counts people -- not just the Overview.
--
-- After gam_active_user_status fixed the roster, an audit of the module found
-- four more read paths that still carried deactivated users:
--
--   gam_eligible_points     excluded user_status = 'inactive' but let an ended
--                           employment through, and treated 'rejected' /
--                           'pending_approval' as active
--   gam_selectable_users    read is_active only, so the "Selected people"
--                           picker still offered deactivated reps
--   gam_revenue_by_user     no filter at all, so "cost of revenue" divided
--                           active-only rewards by everybody's revenue
--   gam_spend_by_month      no filter, so the spend trend and its "people"
--                           count included money paid to people who have left
--   gam_refresh_leaderboard no filter, so every snapshot it writes revives them
--
-- The predicate below is the same one gam_is_active_user now states:
--   is_active IS NOT FALSE
--   AND COALESCE(user_status, 'active') = 'active'
--   AND no employees.date_of_exit in the past
-- It is inlined, not called, wherever it sits on a row-heavy path.

-- Ranking input. gam_activity_rankings and gam_game_rankings both build on
-- this, so they inherit the fix; their RANK() is computed after the filter and
-- therefore still reads 1, 2, 3 rather than 1, 4, 9.
create or replace function public.gam_eligible_points(
  p_from timestamptz,
  p_to   timestamptz
)
returns table(id uuid, user_id uuid, game_id uuid, action_id uuid, points numeric,
              earned_at timestamptz, reference_type text, reference_id uuid, retailer_id uuid)
language sql
stable
security definer
set search_path to 'public'
as $$
  SELECT gp.id, gp.user_id, gp.game_id, gp.action_id, gp.points, gp.earned_at,
         gp.reference_type, gp.reference_id, gp.retailer_id
  FROM gamification_points gp
  JOIN gamification_actions ga ON ga.id = gp.action_id
  JOIN profiles pr ON pr.id = gp.user_id
  WHERE gp.earned_at >= p_from AND gp.earned_at <= p_to
    AND COALESCE(gp.status, 'active') = 'active'
    AND (gp.expires_at IS NULL OR gp.expires_at > now())
    AND COALESCE(ga.leaderboard, true) = true
    AND pr.is_active IS NOT FALSE
    AND COALESCE(pr.user_status::text, 'active') = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = pr.id AND e.date_of_exit IS NOT NULL AND e.date_of_exit <= now()
    );
$$;

-- Who the "Selected people" picker may offer.
create or replace function public.gam_selectable_users()
returns table(user_id uuid, full_name text, profile_picture_url text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select p.id, coalesce(p.full_name, p.username, 'Unknown')::text, p.profile_picture_url
  from public.profiles p
  left join public.employees e on e.user_id = p.id
  where auth.uid() is not null
    and p.is_active is not false
    and coalesce(p.user_status::text, 'active') = 'active'
    and (e.date_of_exit is null or e.date_of_exit > now())
  group by p.id, p.full_name, p.username, p.profile_picture_url
  order by 2;
$$;

-- Revenue behind the cost-of-revenue ratio. Rewards are now counted for active
-- people only, so the denominator has to be drawn from the same roster or the
-- percentage flatters itself.
create or replace function public.gam_revenue_by_user(
  p_from timestamptz,
  p_to   timestamptz
)
returns table(user_id uuid, revenue numeric, orders bigint)
language sql
stable
security definer
set search_path to 'public'
as $$
  SELECT o.user_id,
         COALESCE(SUM(o.total_amount), 0)::numeric AS revenue,
         COUNT(*)::bigint AS orders
  FROM public.orders o
  WHERE o.user_id IS NOT NULL
    AND o.status IN ('confirmed','delivered','dispatched','partial_delivery','processing')
    AND o.created_at >= p_from
    AND o.created_at <= p_to
    AND EXISTS (
      SELECT 1
        FROM public.profiles pr
        LEFT JOIN public.employees e ON e.user_id = pr.id
       WHERE pr.id = o.user_id
         AND pr.is_active IS NOT FALSE
         AND COALESCE(pr.user_status::text, 'active') = 'active'
         AND (e.date_of_exit IS NULL OR e.date_of_exit > now())
    )
  GROUP BY o.user_id;
$$;

-- What the scheme has cost month by month, and how many people it paid.
create or replace function public.gam_spend_by_month(p_months integer default 12)
returns table(month date, points numeric, rupees numeric, awards bigint, people bigint)
language sql
stable
security definer
set search_path to 'public'
as $$
  WITH bounds AS (
    SELECT date_trunc('month', now())::date - ((GREATEST(p_months,1)-1)||' months')::interval AS start_m
  ),
  months AS (
    SELECT generate_series((SELECT start_m FROM bounds), date_trunc('month', now()), '1 month')::date AS month
  ),
  rate AS (
    SELECT g.id AS game_id,
           COALESCE(NULLIF(g.points_to_rupee_conversion,0),
                    (SELECT NULLIF(s.point_conversion,0) FROM public.gamification_settings s LIMIT 1),
                    1) AS r
    FROM public.gamification_games g
  ),
  agg AS (
    SELECT date_trunc('month', gp.earned_at)::date AS month,
           SUM(gp.points) AS points,
           SUM(gp.points * COALESCE(rate.r,1)) AS rupees,
           COUNT(*) AS awards,
           COUNT(DISTINCT gp.user_id) AS people
    FROM public.gamification_points gp
    LEFT JOIN rate ON rate.game_id = gp.game_id
    WHERE gp.earned_at >= (SELECT start_m FROM bounds)
      AND EXISTS (
        SELECT 1
          FROM public.profiles pr
          LEFT JOIN public.employees e ON e.user_id = pr.id
         WHERE pr.id = gp.user_id
           AND pr.is_active IS NOT FALSE
           AND COALESCE(pr.user_status::text, 'active') = 'active'
           AND (e.date_of_exit IS NULL OR e.date_of_exit > now())
      )
    GROUP BY 1
  )
  SELECT m.month,
         COALESCE(a.points,0)::numeric,
         COALESCE(a.rupees,0)::numeric,
         COALESCE(a.awards,0)::bigint,
         COALESCE(a.people,0)::bigint
  FROM months m LEFT JOIN agg a ON a.month = m.month
  ORDER BY m.month;
$$;

-- Snapshot writer. Without the filter every refresh put deactivated people back
-- onto a stored board, which then outlives the filtering done at read time.
create or replace function public.gam_refresh_leaderboard(p_period_type text default 'month')
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_start timestamptz; v_end timestamptz; v_label text; v_rows integer;
  v_store_type text;
BEGIN
  IF p_period_type IN ('week', 'weekly') THEN
    v_start := date_trunc('week', now()); v_end := v_start + interval '1 week';
    v_label := to_char(v_start, 'IYYY-"W"IW');
    v_store_type := 'weekly';
  ELSIF p_period_type = 'all_time' THEN
    v_start := '-infinity'::timestamptz; v_end := 'infinity'::timestamptz; v_label := 'All time';
    v_store_type := 'all_time';
  ELSE
    v_start := date_trunc('month', now()); v_end := v_start + interval '1 month';
    v_label := to_char(v_start, 'YYYY-MM');
    v_store_type := 'monthly';
  END IF;

  DELETE FROM public.leaderboard_snapshots
  WHERE period_type = v_store_type AND period_label = v_label;

  INSERT INTO public.leaderboard_snapshots
    (period_type, period_start, period_end, period_label, user_id, rank, total_points, full_name, profile_picture_url, captured_at)
  SELECT v_store_type,
         CASE WHEN v_start = '-infinity'::timestamptz THEN now() - interval '100 years' ELSE v_start END,
         CASE WHEN v_end = 'infinity'::timestamptz THEN now() ELSE v_end END,
         v_label,
         t.user_id,
         ROW_NUMBER() OVER (ORDER BY t.total DESC),
         t.total,
         p.full_name,
         NULL,
         now()
  FROM (
    SELECT gp.user_id, SUM(gp.points) AS total
    FROM public.gamification_points gp
    JOIN public.gamification_actions a ON a.id = gp.action_id
    WHERE gp.status = 'active'
      AND (gp.expires_at IS NULL OR gp.expires_at > now())
      AND COALESCE(a.leaderboard, true)
      AND gp.earned_at >= v_start AND gp.earned_at < v_end
    GROUP BY gp.user_id
  ) t
  JOIN public.profiles p ON p.id = t.user_id
  LEFT JOIN public.employees e ON e.user_id = p.id
  WHERE p.is_active IS NOT FALSE
    AND COALESCE(p.user_status::text, 'active') = 'active'
    AND (e.date_of_exit IS NULL OR e.date_of_exit > now());

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$function$;

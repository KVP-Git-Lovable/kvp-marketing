-- Tiered activities pay one rung, not every rung.
--
-- gamification_actions.tier_mode has existed and defaulted to 'highest' since
-- the column was added, and neither award function ever read it. Both looped
-- over `threshold_pct <= achievement` and inserted a row per rung, so a rep who
-- reached 100% of a six-rung target was paid all six: 1,800 points where the
-- top rung is worth 375.
--
-- Two things are fixed here. The obvious one is honouring tier_mode. The one
-- that is easy to miss is the idempotency guard: it skipped a rung already
-- awarded, which still overpays when someone climbs. A rep who hits 40% takes
-- 300, later hits 100%, and 100% has not been awarded yet — so they end on 675.
-- Under 'highest' the question is not "have we paid this rung" but "what do we
-- still owe", so the insert is the difference between the top rung's value and
-- everything this period has already paid for the activity. That is naturally
-- idempotent (a re-run owes zero) and it tops up instead of stacking.
--
-- 'all' keeps the old behaviour, per-rung guard included, for anyone who wants
-- cumulative tiers.
--
-- This does not touch points already issued. Two balances on staging are over
-- by 1,425 each; correcting them is a separate, deliberate act.

CREATE OR REPLACE FUNCTION public.gam_award_tiers_for_target(
  p_user_id uuid,
  p_kpi_id uuid,
  p_period_start date,
  p_achievement numeric,
  p_dry_run boolean DEFAULT NULL::boolean
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s public.gamification_settings%ROWTYPE;
  v_dry boolean; a record; t record; v_awards integer := 0;
  v_period_key text;
  v_month_end date;
  v_top_tier numeric;
  v_owed numeric;
  v_already numeric;
BEGIN
  IF p_user_id IS NULL OR p_kpi_id IS NULL OR p_period_start IS NULL THEN RETURN 0; END IF;

  v_period_key := to_char(p_period_start, 'YYYY-MM');
  v_month_end := (p_period_start + interval '1 month' - interval '1 day')::date;

  SELECT * INTO s FROM public.gamification_settings LIMIT 1;
  v_dry := COALESCE(p_dry_run, NOT COALESCE(s.engine_enabled, false));

  FOR a IN
    SELECT act.* FROM public.gamification_actions act
    JOIN public.gamification_games g ON g.id = act.game_id
    WHERE act.is_enabled AND g.is_active AND act.is_tiered AND act.kpi_id = p_kpi_id
      AND (act.validity_from IS NULL OR act.validity_from <= v_month_end)
      AND (act.validity_to IS NULL OR act.validity_to >= p_period_start)
  LOOP
    IF NOT public.gam_is_eligible(a.id, p_user_id) THEN CONTINUE; END IF;

    IF COALESCE(a.tier_mode, 'highest') = 'highest' THEN
      -- The best rung reached, and only that one.
      SELECT t2.threshold_pct, t2.points INTO v_top_tier, v_owed
      FROM public.activity_tiers t2
      WHERE t2.action_id = a.id AND t2.threshold_pct <= COALESCE(p_achievement, 0)
      ORDER BY t2.threshold_pct DESC
      LIMIT 1;

      IF v_top_tier IS NULL THEN CONTINUE; END IF;

      SELECT COALESCE(SUM(gp.points), 0) INTO v_already
      FROM public.gamification_points gp
      WHERE gp.action_id = a.id AND gp.user_id = p_user_id
        AND gp.period_key = v_period_key
        AND gp.reference_type = 'target_tier';

      -- Already square, or ahead of what the rung is worth: nothing owed.
      IF v_owed - v_already <= 0 THEN CONTINUE; END IF;

      IF v_dry THEN v_awards := v_awards + 1; CONTINUE; END IF;

      INSERT INTO public.gamification_points
        (user_id, game_id, action_id, points, reference_type, earned_at, expires_at, status, period_key, metadata)
      VALUES
        (p_user_id, a.game_id, a.id, v_owed - v_already, 'target_tier', now(),
         public.gam_compute_expiry(a.expiry_type, a.expiry_days, now()), 'active', v_period_key,
         jsonb_build_object(
           'tier_threshold', v_top_tier,
           'achievement_percent', p_achievement,
           'tier_mode', 'highest',
           'tier_value', v_owed,
           'already_paid', v_already))
      ON CONFLICT DO NOTHING;

      v_awards := v_awards + 1;

    ELSE
      -- 'all': every rung reached, one award each, as before.
      FOR t IN
        SELECT * FROM public.activity_tiers
        WHERE action_id = a.id AND threshold_pct <= COALESCE(p_achievement, 0)
        ORDER BY threshold_pct
      LOOP
        IF EXISTS (
          SELECT 1 FROM public.gamification_points gp
          WHERE gp.action_id = a.id AND gp.user_id = p_user_id
            AND gp.period_key = v_period_key
            AND gp.reference_type = 'target_tier'
            AND (gp.metadata->>'tier_threshold')::numeric = t.threshold_pct
        ) THEN CONTINUE; END IF;

        IF v_dry THEN v_awards := v_awards + 1; CONTINUE; END IF;

        INSERT INTO public.gamification_points
          (user_id, game_id, action_id, points, reference_type, earned_at, expires_at, status, period_key, metadata)
        VALUES
          (p_user_id, a.game_id, a.id, t.points, 'target_tier', now(),
           public.gam_compute_expiry(a.expiry_type, a.expiry_days, now()), 'active', v_period_key,
           jsonb_build_object('tier_threshold', t.threshold_pct, 'achievement_percent', p_achievement))
        ON CONFLICT DO NOTHING;

        v_awards := v_awards + 1;
      END LOOP;
    END IF;
  END LOOP;

  RETURN v_awards;
END;
$function$;


CREATE OR REPLACE FUNCTION public.gam_award_daily_visit_tiers(
  p_user_id uuid,
  p_visit_date date,
  p_dry_run boolean DEFAULT NULL::boolean
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s public.gamification_settings%ROWTYPE;
  v_dry boolean; a record; t record; v_awards integer := 0;
  v_productive integer;
  v_pct numeric;
  v_period_key text;
  v_top_tier numeric;
  v_owed numeric;
  v_already numeric;
BEGIN
  IF p_user_id IS NULL OR p_visit_date IS NULL THEN RETURN 0; END IF;

  v_period_key := to_char(p_visit_date, 'YYYY-MM-DD');

  SELECT * INTO s FROM public.gamification_settings LIMIT 1;
  v_dry := COALESCE(p_dry_run, NOT COALESCE(s.engine_enabled, false));

  SELECT count(*) INTO v_productive
  FROM public.visits
  WHERE user_id = p_user_id AND planned_date = p_visit_date AND status = 'productive';

  IF v_productive <= 0 THEN RETURN 0; END IF;

  FOR a IN
    SELECT act.* FROM public.gamification_actions act
    JOIN public.gamification_games g ON g.id = act.game_id
    WHERE act.is_enabled AND g.is_active
      AND act.is_tiered AND act.kpi_id IS NULL
      AND COALESCE(act.trigger_type, act.action_type) = 'total_visits'
      AND COALESCE(act.base_daily_target, 0) > 0
      AND (act.validity_from IS NULL OR act.validity_from <= p_visit_date)
      AND (act.validity_to IS NULL OR act.validity_to >= p_visit_date)
  LOOP
    IF NOT public.gam_is_eligible(a.id, p_user_id) THEN CONTINUE; END IF;

    v_pct := ROUND((v_productive::numeric / a.base_daily_target) * 100, 2);

    IF COALESCE(a.tier_mode, 'highest') = 'highest' THEN
      SELECT t2.threshold_pct, t2.points INTO v_top_tier, v_owed
      FROM public.activity_tiers t2
      WHERE t2.action_id = a.id AND t2.threshold_pct <= v_pct
      ORDER BY t2.threshold_pct DESC
      LIMIT 1;

      IF v_top_tier IS NULL THEN CONTINUE; END IF;

      SELECT COALESCE(SUM(gp.points), 0) INTO v_already
      FROM public.gamification_points gp
      WHERE gp.action_id = a.id AND gp.user_id = p_user_id
        AND gp.period_key = v_period_key
        AND gp.reference_type = 'visit_tier';

      IF v_owed - v_already <= 0 THEN CONTINUE; END IF;

      IF v_dry THEN v_awards := v_awards + 1; CONTINUE; END IF;

      INSERT INTO public.gamification_points
        (user_id, game_id, action_id, points, reference_type, earned_at, expires_at, status, period_key, metadata)
      VALUES
        (p_user_id, a.game_id, a.id, v_owed - v_already, 'visit_tier', now(),
         public.gam_compute_expiry(a.expiry_type, a.expiry_days, now()), 'active', v_period_key,
         jsonb_build_object(
           'tier_threshold', v_top_tier,
           'productive_visits', v_productive,
           'daily_visit_target', a.base_daily_target,
           'visit_date', p_visit_date,
           'tier_mode', 'highest',
           'tier_value', v_owed,
           'already_paid', v_already))
      ON CONFLICT DO NOTHING;

      v_awards := v_awards + 1;

    ELSE
      FOR t IN
        SELECT * FROM public.activity_tiers
        WHERE action_id = a.id AND threshold_pct <= v_pct
        ORDER BY threshold_pct
      LOOP
        IF EXISTS (
          SELECT 1 FROM public.gamification_points gp
          WHERE gp.action_id = a.id AND gp.user_id = p_user_id
            AND gp.period_key = v_period_key
            AND gp.reference_type = 'visit_tier'
            AND (gp.metadata->>'tier_threshold')::numeric = t.threshold_pct
        ) THEN CONTINUE; END IF;

        IF v_dry THEN v_awards := v_awards + 1; CONTINUE; END IF;

        INSERT INTO public.gamification_points
          (user_id, game_id, action_id, points, reference_type, earned_at, expires_at, status, period_key, metadata)
        VALUES
          (p_user_id, a.game_id, a.id, t.points, 'visit_tier', now(),
           public.gam_compute_expiry(a.expiry_type, a.expiry_days, now()), 'active', v_period_key,
           jsonb_build_object(
             'tier_threshold', t.threshold_pct,
             'productive_visits', v_productive,
             'daily_visit_target', a.base_daily_target,
             'visit_date', p_visit_date))
        ON CONFLICT DO NOTHING;

        v_awards := v_awards + 1;
      END LOOP;
    END IF;
  END LOOP;

  RETURN v_awards;
END;
$function$;

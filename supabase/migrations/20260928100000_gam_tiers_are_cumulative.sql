-- Tier rewards are cumulative. Reverses the 21 September change.
--
-- On 21 September these two functions were changed to pay only the highest
-- rung reached, on the understanding that tier_mode = 'highest' -- the column
-- default, which nothing had ever read -- expressed the intent. It did not.
-- The business rule is that reaching six rungs pays all six: 100 + 150 + 200 +
-- 250 + 325 + 375 = 1,400, not 375.
--
-- So the 'highest' branch is removed from both functions rather than left
-- behind a flag, and tier_mode stops being consulted at all. The column has
-- one value across all 16 activities, is written as a hard-coded constant by
-- ActivityForm and has never had a control anywhere in the app, so there is no
-- configuration to preserve -- only a default that was mistaken for a decision.
--
-- IDEMPOTENCY is unchanged and comes from two places that were already there:
-- the EXISTS check on metadata->>'tier_threshold' below, and the unique indexes
-- ux_gam_points_target_tier_once / ux_gam_points_visit_tier_once on
-- (action_id, user_id, period_key, tier_threshold). Re-running an award for a
-- period a rep has already been paid for inserts nothing. The rows written by
-- the original cumulative behaviour carry their tier_threshold, so they are
-- recognised and not paid a second time.

create or replace function public.gam_award_tiers_for_target(
  p_user_id uuid,
  p_kpi_id uuid,
  p_period_start date,
  p_achievement numeric,
  p_dry_run boolean default null
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  s public.gamification_settings%ROWTYPE;
  v_dry boolean; a record; t record; v_awards integer := 0;
  v_period_key text;
  v_month_end date;
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

    -- Every rung at or below what they achieved, each paid once.
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
  END LOOP;

  RETURN v_awards;
END;
$function$;


create or replace function public.gam_award_daily_visit_tiers(
  p_user_id uuid,
  p_visit_date date,
  p_dry_run boolean default null
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  s public.gamification_settings%ROWTYPE;
  v_dry boolean; a record; t record; v_awards integer := 0;
  v_productive integer;
  v_pct numeric;
  v_period_key text;
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
  END LOOP;

  RETURN v_awards;
END;
$function$;


-- The column now says what the engine does, instead of naming a rule nothing
-- applies. It is kept rather than dropped because ActivityForm still writes it
-- and the generated types still carry it; making it read 'cumulative' is the
-- change that stops it being misleading.
update public.gamification_actions
   set tier_mode = 'cumulative'
 where tier_mode is distinct from 'cumulative';


-- Give back the two deductions taken on 21 September.
--
-- A reversing row rather than a delete: the original correction is part of
-- what happened, and the drill-down already shows corrections with their
-- reason, so both entries read as a pair instead of one quietly vanishing.
-- Matched on the correction marker and the exact amount so re-running this
-- migration cannot pay anybody twice.
insert into public.gamification_points
  (user_id, game_id, action_id, points, reference_type, earned_at, expires_at,
   status, period_key, metadata)
select c.user_id, c.game_id, c.action_id, -c.points, c.reference_type, now(), c.expires_at,
       'active', c.period_key,
       jsonb_build_object(
         'correction', true,
         'reverses', c.id::text,
         'reason', 'Tier rewards are cumulative after all: the 21 September deduction '
                || 'assumed only the highest rung should pay, which was not the business rule. '
                || 'This restores the points it removed.')
from public.gamification_points c
where c.points < 0
  and c.reference_type = 'target_tier'
  and (c.metadata->>'correction') = 'true'
  and not exists (
    select 1 from public.gamification_points r
    where (r.metadata->>'reverses') = c.id::text
  );

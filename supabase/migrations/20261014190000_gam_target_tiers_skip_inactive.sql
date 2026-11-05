-- The target evaluator walked every user_period_targets row for the period,
-- including rows belonging to people who have been deactivated. It is the one
-- gamification write path that was still doing so, and a deactivated rep whose
-- target row survives (because the business plan behind it survives) would be
-- paid for a period they did not work.
create or replace function public.gam_evaluate_target_tiers(
  p_period_key text default to_char(now(), 'YYYY-MM'),
  p_dry_run    boolean default null
)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  upt record; v_awards integer := 0;
  v_start date := to_date(p_period_key || '-01', 'YYYY-MM-DD');
BEGIN
  FOR upt IN
    SELECT u.user_id, u.kpi_id, u.period_start, u.achievement_percent
    FROM public.user_period_targets u
    WHERE u.period_start >= v_start
      AND u.period_start < (v_start + interval '1 month')
      AND u.kpi_id IS NOT NULL
      AND public.gam_is_active_user(u.user_id)
  LOOP
    v_awards := v_awards + public.gam_award_tiers_for_target(
      upt.user_id, upt.kpi_id, upt.period_start, upt.achievement_percent, p_dry_run);
  END LOOP;

  RETURN v_awards;
END;
$function$;

-- Seed the activation activity into Retailer growth.
--
-- Created DISABLED with a worked-example ladder (1st order >= 5000 -> 100,
-- then 2nd >= 3000 -> 150, sequential). The business sets its own thresholds
-- and switches it on; until then nothing can pay, and the ladder is visible on
-- the activity card so the configuration can be reviewed before it goes live.
--
-- Guarded so re-running never produces a second copy.
do $$
declare
  v_game uuid;
  v_action uuid;
begin
  select id into v_game from public.gamification_games where name = 'Retailer growth' limit 1;
  if v_game is null then return; end if;

  select id into v_action from public.gamification_actions
  where game_id = v_game and coalesce(trigger_type, action_type) = 'new_retailer_activation'
  limit 1;

  if v_action is not null then return; end if;

  insert into public.gamification_actions
    (game_id, action_type, trigger_type, action_name, description, points,
     is_enabled, is_tiered, tier_mode, award_mode, leaderboard,
     expiry_type, cap_scope, conditions_json, metadata)
  values
    (v_game, 'new_retailer_activation', 'new_retailer_activation',
     'New retailer activation',
     'Rewards a ladder of order milestones after a retailer is created.',
     -- Points live on the rungs, not on the activity, so this stays zero.
     0, false, true, 'sequential', 'auto', true,
     'fy_end', 'none', '[]'::jsonb, '{}'::jsonb)
  returning id into v_action;

  -- threshold_pct is unused by order milestones but kept populated, since the
  -- column predates them and target rungs rely on it.
  insert into public.activity_tiers
    (action_id, threshold_pct, points, sort, order_ordinal, basis, operator, threshold)
  values
    (v_action, 0, 100, 1, 1, 'order_value', '>=', 5000),
    (v_action, 0, 150, 2, 2, 'order_value', '>=', 3000);
end $$;

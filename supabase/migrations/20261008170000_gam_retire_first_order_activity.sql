-- Retire the original first-order activity, preserving its history.
--
-- f216dd26 is the activity that paid a flat 55 points on a new retailer's
-- first order, 37 times between 12 June and 1 October, to 8 reps across 24
-- retailers, for 1,285 points of which 24 awards are still active. It was
-- later repurposed into an order-milestone ladder by a trigger change, which
-- also renamed it. The ladder work now lives in "New retailer activation"
-- (90e0f160), so this one is retired.
--
-- WHAT THIS DOES NOT TOUCH: gamification_points. Not one row. Points,
-- balances, expiry dates, redemptions and the ledger are untouched, and every
-- historical row already records metadata->>'trigger' = 'first_order_new_retailer',
-- so the awards remain self-describing regardless of what the activity says.
--
-- The name is restored because the ledger and the drill-downs display the
-- CURRENT action_name: without this, 37 awards earned as a first-order reward
-- would render under "First second order from new retailer", which is not the
-- activity that earned them. "(retired)" is appended so nobody re-enables it
-- by accident.
--
-- The trigger, tiered flag and points are restored for the same reason — the
-- activity should describe what it did, not what it was briefly reconfigured
-- as. Its two milestone rungs are removed; they were added on 8 October and
-- have no connection to the 37 awards.
--
-- cap_scope and cap_value are deliberately left as they are. They have no
-- effect on a disabled activity and changing them would be noise.
do $$
declare
  v_id uuid := 'f216dd26-cf81-4584-bc15-68106e469744';
  v_before_awards integer;
  v_before_points numeric;
  v_after_awards integer;
  v_after_points numeric;
begin
  if not exists (select 1 from public.gamification_actions where id = v_id) then
    return;
  end if;

  select count(*), coalesce(sum(points), 0)
    into v_before_awards, v_before_points
  from public.gamification_points where action_id = v_id;

  delete from public.activity_tiers where action_id = v_id;

  update public.gamification_actions
  set is_enabled   = false,
      action_name  = 'First order from new retailer (retired)',
      action_type  = 'first_order_new_retailer',
      trigger_type = 'first_order_new_retailer',
      is_tiered    = false,
      tier_mode    = 'cumulative',
      points       = 55,
      description  = 'Retired on 8 October 2026. Paid 55 points on a new retailer''s first order; '
                     'superseded by the New retailer activation milestone ladder. '
                     'Historical awards are preserved and unchanged.',
      updated_at   = now()
  where id = v_id;

  select count(*), coalesce(sum(points), 0)
    into v_after_awards, v_after_points
  from public.gamification_points where action_id = v_id;

  -- Retiring an activity must never cost a rep a point.
  if v_before_awards <> v_after_awards or v_before_points <> v_after_points then
    raise exception 'Retirement altered award history: % awards / % points became % / %',
      v_before_awards, v_before_points, v_after_awards, v_after_points;
  end if;
end $$;

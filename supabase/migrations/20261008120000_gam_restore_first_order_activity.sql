-- Put "First order from new retailer" back, and switch the activation ladder on.
--
-- The first-order activity was converted into an order-milestone ladder by a
-- trigger change in the admin form: trigger_type became new_retailer_activation
-- and is_tiered became true. That took it OUT of service, because
-- gam_award_event deliberately skips tiered activities — so the flat 55 points
-- it had paid 37 times would have stopped the moment the new client code
-- shipped.
--
-- This restores it to exactly what it was before that edit and moves the
-- ladder to the activity built for it.
--
-- cap_value is included in the revert: it had been 550 and was 5000 after the
-- edit. If that increase was deliberate it needs re-applying by hand — it is
-- reverted here because it was changed in the same sitting as the conversion
-- and there is no way to tell the two apart from the row alone.
do $$
declare
  v_first uuid;
  v_ladder uuid;
begin
  select id into v_first from public.gamification_actions
  where action_name = 'First order from new retailer' limit 1;

  if v_first is not null then
    -- Rungs only ever belonged to this activity by accident.
    delete from public.activity_tiers where action_id = v_first;

    update public.gamification_actions
    set action_type  = 'first_order_new_retailer',
        trigger_type = 'first_order_new_retailer',
        is_tiered    = false,
        -- NOT NULL, and the value every other non-tiered activity carries.
        tier_mode    = 'cumulative',
        points       = 55,
        cap_scope    = 'user_month',
        cap_value    = 550,
        is_enabled   = true,
        updated_at   = now()
    where id = v_first;
  end if;

  -- The activity this work was built for. Its ladder is already seeded:
  -- 1st order >= 5000 -> 100, then 2nd >= 3000 -> 150, sequential.
  select id into v_ladder from public.gamification_actions
  where action_name = 'New retailer activation' limit 1;

  if v_ladder is not null then
    update public.gamification_actions
    set is_enabled = true, updated_at = now()
    where id = v_ladder;
  end if;
end $$;

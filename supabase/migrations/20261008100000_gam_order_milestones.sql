-- New retailer activation: a ladder of order milestones on one activity.
--
-- The module already has two award paths. gam_award_event pays ONE amount per
-- activity, so a ladder cannot live there. Tiered activities own a ladder in
-- activity_tiers and are paid by dedicated functions — and gam_award_event
-- deliberately skips them (is_tiered = false). This adds the third such
-- awarder, for ladders measured against a retailer's order sequence rather
-- than against a target percentage.
--
-- activity_tiers gains four NULLABLE columns so the four live tiered
-- activities (Quantity target, Revenue target, Visit target, Productive visit)
-- are untouched: they keep using threshold_pct and keep being paid by
-- gam_award_tiers_for_target / gam_award_daily_visit_tiers.

alter table public.activity_tiers
  add column if not exists order_ordinal integer,
  add column if not exists basis text,
  add column if not exists operator text,
  add column if not exists threshold numeric;

comment on column public.activity_tiers.order_ordinal is
  'Order milestones only: which order in the retailer''s sequence this rung judges (1 = first). Null on target/visit rungs.';
comment on column public.activity_tiers.basis is
  'Order milestones only: order_value or order_quantity.';
comment on column public.activity_tiers.operator is
  'Order milestones only: >=, >, <=, < or =. Defaults to >= when absent.';
comment on column public.activity_tiers.threshold is
  'Order milestones only: an ABSOLUTE threshold (rupees or units), as opposed to threshold_pct which is a percentage of a target.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'activity_tiers_basis_check'
  ) then
    alter table public.activity_tiers
      add constraint activity_tiers_basis_check
      check (basis is null or basis in ('order_value', 'order_quantity'));
  end if;
end $$;


-- Is one rung of the ladder satisfied by the retailer's n-th order?
--
-- Derived from the ORDER HISTORY rather than from the award ledger. The
-- obvious alternative — "milestone 2 may pay once milestone 1 has been
-- awarded" — breaks the moment milestone 1 is met but not paid, because a cap
-- was full or the engine was disabled that day. The rep would then be locked
-- out of milestone 2 permanently through no fault of their own. Asking the
-- orders keeps the rule about what the retailer actually did.
--
-- Cancelled and replaced orders never count, so a cancelled first order does
-- not shift every ordinal after it.
create or replace function public.gam_milestone_met(
  p_retailer uuid,
  p_ordinal integer,
  p_basis text,
  p_operator text,
  p_threshold numeric
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  with ranked as (
    select o.id,
           row_number() over (order by o.order_date, o.created_at, o.id) as pos,
           coalesce(o.total_amount, 0)::numeric as order_value,
           coalesce((select sum(oi.quantity) from public.order_items oi where oi.order_id = o.id), 0)::numeric
             as order_quantity
    from public.orders o
    where o.retailer_id = p_retailer
      and coalesce(o.status, '') not in ('cancelled', 'replaced')
  ),
  hit as (
    select case when coalesce(p_basis, 'order_value') = 'order_quantity'
                then r.order_quantity else r.order_value end as actual
    from ranked r
    where r.pos = p_ordinal
  )
  select coalesce((
    select case coalesce(p_operator, '>=')
             when '>='  then h.actual >= p_threshold
             when '>'   then h.actual >  p_threshold
             when '<='  then h.actual <= p_threshold
             when '<'   then h.actual <  p_threshold
             when '='   then h.actual =  p_threshold
             else false
           end
    from hit h
  ), false);
$function$;

revoke all on function public.gam_milestone_met(uuid, integer, text, text, numeric) from public;
grant execute on function public.gam_milestone_met(uuid, integer, text, text, numeric) to authenticated;


-- Pay the order-milestone ladders that this order completes.
--
-- Called for EVERY order, not only first ones: the ladder decides which orders
-- it cares about through each rung's order_ordinal.
--
-- tier_mode drives how the ladder pays:
--   cumulative      every rung that is met pays, independently
--   sequential      a rung pays only if every rung before it is also met
--   all_or_nothing  nothing pays until the whole ladder is met, then the total
--                   lands as one award on the final rung
--
-- Idempotency is per (activity, user, retailer, rung): activation happens once
-- per retailer in a lifetime, not once a month, so period_key is not part of
-- the key the way it is for target tiers.
create or replace function public.gam_award_order_milestones(
  p_user uuid,
  p_retailer uuid,
  p_order_id uuid,
  p_dry_run boolean default null
)
returns table (
  action_id uuid,
  action_name text,
  milestone integer,
  points numeric,
  awarded boolean,
  reason text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  s public.gamification_settings%ROWTYPE;
  v_dry boolean;
  v_now timestamptz := now();
  a record;
  t record;
  v_ordinal integer;
  v_value numeric;
  v_qty numeric;
  v_age integer;
  v_ctx jsonb;
  v_expires timestamptz;
  v_pay numeric;
  v_blocked boolean;
  v_complete boolean;
  v_last integer;
BEGIN
  IF p_user IS NULL OR p_retailer IS NULL OR p_order_id IS NULL THEN RETURN; END IF;

  SELECT * INTO s FROM public.gamification_settings LIMIT 1;
  v_dry := COALESCE(p_dry_run, NOT COALESCE(s.engine_enabled, false));

  -- Where this order sits in the retailer's sequence, and what it is worth.
  SELECT q.pos, q.order_value, q.order_quantity
    INTO v_ordinal, v_value, v_qty
  FROM (
    SELECT o.id,
           row_number() OVER (ORDER BY o.order_date, o.created_at, o.id) AS pos,
           COALESCE(o.total_amount, 0)::numeric AS order_value,
           COALESCE((SELECT SUM(oi.quantity) FROM public.order_items oi WHERE oi.order_id = o.id), 0)::numeric
             AS order_quantity
    FROM public.orders o
    WHERE o.retailer_id = p_retailer
      AND COALESCE(o.status, '') NOT IN ('cancelled', 'replaced')
  ) q
  WHERE q.id = p_order_id;

  -- A cancelled or replaced order has no position, so it pays nothing.
  IF v_ordinal IS NULL THEN RETURN; END IF;

  SELECT GREATEST(0, (v_now::date - r.created_at::date)) INTO v_age
  FROM public.retailers r WHERE r.id = p_retailer;

  v_ctx := jsonb_build_object(
    'order_ordinal', v_ordinal,
    'order_value', v_value,
    'order_quantity', v_qty,
    'retailer_age_days', COALESCE(v_age, 0)
  );

  FOR a IN
    SELECT act.* FROM public.gamification_actions act
    JOIN public.gamification_games g ON g.id = act.game_id
    WHERE act.is_enabled = true
      AND g.is_active = true
      AND COALESCE(act.trigger_type, act.action_type) = 'new_retailer_activation'
      AND COALESCE(act.is_tiered, false) = true
      AND (act.validity_from IS NULL OR act.validity_from <= v_now::date)
      AND (act.validity_to   IS NULL OR act.validity_to   >= v_now::date)
      AND (g.start_date IS NULL OR g.start_date <= v_now::date)
      AND (g.end_date   IS NULL OR g.end_date   >= v_now::date)
  LOOP
    IF NOT public.gam_is_eligible(a.id, p_user) THEN
      action_id := a.id; action_name := a.action_name; milestone := NULL; points := 0;
      awarded := false; reason := 'not_eligible'; RETURN NEXT; CONTINUE;
    END IF;

    -- Activity-level gate. The activation window lives here as an ordinary
    -- condition on retailer_age_days, so it reuses the existing evaluator
    -- rather than inventing a second way to express a rule.
    IF NOT public.gam_conditions_match(a.conditions_json, v_ctx) THEN
      action_id := a.id; action_name := a.action_name; milestone := NULL; points := 0;
      awarded := false; reason := 'conditions_not_met'; RETURN NEXT; CONTINUE;
    END IF;

    SELECT MAX(x.order_ordinal) INTO v_last
    FROM public.activity_tiers x WHERE x.action_id = a.id AND x.order_ordinal IS NOT NULL;

    -- Aliased: the OUT parameter action_id would otherwise shadow the column.
    FOR t IN
      SELECT tt.* FROM public.activity_tiers tt
      WHERE tt.action_id = a.id AND tt.order_ordinal = v_ordinal
      ORDER BY tt.sort, tt.order_ordinal
    LOOP
      action_id := a.id; action_name := a.action_name;
      milestone := t.order_ordinal; points := t.points; awarded := false; reason := NULL;

      IF NOT public.gam_milestone_met(p_retailer, t.order_ordinal, t.basis, t.operator, t.threshold) THEN
        reason := 'threshold_not_met'; RETURN NEXT; CONTINUE;
      END IF;

      -- Already paid for this retailer and rung?
      IF EXISTS (
        SELECT 1 FROM public.gamification_points gp
        WHERE gp.action_id = a.id
          AND gp.user_id = p_user
          AND gp.retailer_id = p_retailer
          AND gp.reference_type = 'order_milestone'
          AND (gp.metadata->>'milestone_ordinal')::integer = t.order_ordinal
      ) THEN
        reason := 'already_awarded'; RETURN NEXT; CONTINUE;
      END IF;

      v_pay := t.points;

      IF COALESCE(a.tier_mode, 'cumulative') = 'sequential' THEN
        -- Every earlier rung must also be met by its own order.
        SELECT EXISTS (
          SELECT 1 FROM public.activity_tiers pr
          WHERE pr.action_id = a.id
            AND pr.order_ordinal IS NOT NULL
            AND pr.order_ordinal < t.order_ordinal
            AND NOT public.gam_milestone_met(p_retailer, pr.order_ordinal, pr.basis, pr.operator, pr.threshold)
        ) INTO v_blocked;

        IF v_blocked THEN reason := 'earlier_milestone_unmet'; RETURN NEXT; CONTINUE; END IF;

      ELSIF COALESCE(a.tier_mode, 'cumulative') = 'all_or_nothing' THEN
        -- Only the final rung pays, and only once the whole ladder is met.
        IF t.order_ordinal IS DISTINCT FROM v_last THEN
          reason := 'ladder_incomplete'; RETURN NEXT; CONTINUE;
        END IF;

        SELECT NOT EXISTS (
          SELECT 1 FROM public.activity_tiers pr
          WHERE pr.action_id = a.id
            AND pr.order_ordinal IS NOT NULL
            AND NOT public.gam_milestone_met(p_retailer, pr.order_ordinal, pr.basis, pr.operator, pr.threshold)
        ) INTO v_complete;

        IF NOT v_complete THEN reason := 'ladder_incomplete'; RETURN NEXT; CONTINUE; END IF;

        SELECT COALESCE(SUM(pr.points), 0) INTO v_pay
        FROM public.activity_tiers pr
        WHERE pr.action_id = a.id AND pr.order_ordinal IS NOT NULL;

        points := v_pay;
      END IF;

      IF v_dry THEN reason := 'dry_run'; RETURN NEXT; CONTINUE; END IF;

      IF NOT public.gam_consume_cap(a.id, p_user, p_retailer, v_now) THEN
        reason := 'cap_reached'; RETURN NEXT; CONTINUE;
      END IF;

      v_expires := public.gam_compute_expiry(a.expiry_type, a.expiry_days, v_now);

      INSERT INTO public.gamification_points
        (user_id, game_id, action_id, points, reference_type, reference_id, earned_at,
         expires_at, status, period_key, retailer_id, metadata)
      VALUES
        (p_user, a.game_id, a.id, v_pay, 'order_milestone', p_order_id, v_now,
         v_expires, 'active', to_char(v_now, 'YYYY-MM'), p_retailer,
         jsonb_build_object(
           'trigger', 'new_retailer_activation',
           'milestone_ordinal', t.order_ordinal,
           'tier_id', t.id,
           'basis', COALESCE(t.basis, 'order_value'),
           'operator', COALESCE(t.operator, '>='),
           'threshold', t.threshold,
           'tier_mode', COALESCE(a.tier_mode, 'cumulative'),
           'context', v_ctx
         ));

      awarded := true; reason := 'awarded';

      IF COALESCE(s.notifications_enabled, true) THEN
        BEGIN
          INSERT INTO public.notifications (user_id, title, message, type)
          VALUES (p_user, 'You earned ' || v_pay || ' points', a.action_name, 'gamification');
        EXCEPTION WHEN others THEN NULL;
        END;
      END IF;

      RETURN NEXT;
    END LOOP;
  END LOOP;
END;
$function$;

revoke all on function public.gam_award_order_milestones(uuid, uuid, uuid, boolean) from public;
grant execute on function public.gam_award_order_milestones(uuid, uuid, uuid, boolean) to authenticated;

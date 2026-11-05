-- The awarder carries the event's weight, and distinguishes a plain miss from
-- one caused by products that have no net weight to prove themselves with.
create or replace function public.gam_award_order_milestones(
  p_user uuid, p_retailer uuid, p_order_id uuid, p_dry_run boolean default null
)
returns table (action_id uuid, action_name text, milestone integer, points numeric, awarded boolean, reason text)
language plpgsql security definer set search_path to 'public'
as $function$
DECLARE
  s public.gamification_settings%ROWTYPE;
  v_dry boolean; v_now timestamptz := now();
  a record; t record;
  v_key text; v_ordinal integer; v_value numeric; v_qty numeric; v_age integer;
  v_kg numeric; v_unweighed integer;
  v_ctx jsonb; v_expires timestamptz; v_pay numeric; v_paid numeric;
  v_blocked boolean; v_complete boolean; v_last integer;
BEGIN
  IF p_user IS NULL OR p_retailer IS NULL OR p_order_id IS NULL THEN RETURN; END IF;

  SELECT * INTO s FROM public.gamification_settings LIMIT 1;
  v_dry := COALESCE(p_dry_run, NOT COALESCE(s.engine_enabled, false));

  SELECT COALESCE(o.visit_id::text, 'day:' || o.order_date::text) INTO v_key
  FROM public.orders o
  WHERE o.id = p_order_id AND o.retailer_id = p_retailer
    AND COALESCE(o.status, '') NOT IN ('cancelled', 'replaced')
    AND COALESCE(o.is_backorder, false) = false;

  IF v_key IS NULL THEN RETURN; END IF;

  SELECT e.ordinal, e.order_value, e.order_quantity, e.order_weight_kg, e.unweighed_lines
    INTO v_ordinal, v_value, v_qty, v_kg, v_unweighed
  FROM public.gam_retailer_purchase_events(p_retailer) e WHERE e.event_key = v_key;

  IF v_ordinal IS NULL THEN RETURN; END IF;

  SELECT GREATEST(0, (v_now::date - r.created_at::date)) INTO v_age
  FROM public.retailers r WHERE r.id = p_retailer;

  v_ctx := jsonb_build_object(
    'order_ordinal', v_ordinal, 'order_value', v_value, 'order_quantity', v_qty,
    'order_weight', v_kg, 'unweighed_lines', COALESCE(v_unweighed, 0),
    'retailer_age_days', COALESCE(v_age, 0), 'event_key', v_key);

  FOR a IN
    SELECT act.* FROM public.gamification_actions act
    JOIN public.gamification_games g ON g.id = act.game_id
    WHERE act.is_enabled = true AND g.is_active = true
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

    IF NOT public.gam_conditions_match(a.conditions_json, v_ctx) THEN
      action_id := a.id; action_name := a.action_name; milestone := NULL; points := 0;
      awarded := false; reason := 'conditions_not_met'; RETURN NEXT; CONTINUE;
    END IF;

    SELECT MAX(x.order_ordinal) INTO v_last
    FROM public.activity_tiers x WHERE x.action_id = a.id AND x.order_ordinal IS NOT NULL;

    FOR t IN
      SELECT tt.* FROM public.activity_tiers tt
      WHERE tt.action_id = a.id AND tt.order_ordinal = v_ordinal
      ORDER BY tt.sort, tt.order_ordinal
    LOOP
      action_id := a.id; action_name := a.action_name;
      milestone := t.order_ordinal; points := t.points; awarded := false; reason := NULL;

      IF NOT public.gam_milestone_met(p_retailer, t.order_ordinal, t.basis, t.operator, t.threshold) THEN
        -- Said apart from a plain miss: the order may well be heavy enough,
        -- but some of its products have no net weight to prove it.
        IF COALESCE(t.basis, '') = 'order_weight' AND COALESCE(v_unweighed, 0) > 0 THEN
          reason := 'threshold_not_met_unweighed_items';
        ELSE
          reason := 'threshold_not_met';
        END IF;
        RETURN NEXT; CONTINUE;
      END IF;

      IF EXISTS (
        SELECT 1 FROM public.gamification_points gp
        WHERE gp.action_id = a.id AND gp.user_id = p_user AND gp.retailer_id = p_retailer
          AND gp.reference_type = 'order_milestone'
          AND (gp.metadata->>'milestone_ordinal')::integer = t.order_ordinal
      ) THEN
        reason := 'already_awarded'; RETURN NEXT; CONTINUE;
      END IF;

      IF EXISTS (
        SELECT 1 FROM public.gamification_points gp
        WHERE gp.action_id = a.id AND gp.retailer_id = p_retailer
          AND gp.reference_type = 'order_milestone'
          AND gp.metadata->>'event_key' = v_key
      ) THEN
        reason := 'event_already_rewarded'; RETURN NEXT; CONTINUE;
      END IF;

      v_pay := t.points;

      IF COALESCE(a.tier_mode, 'cumulative') = 'sequential' THEN
        SELECT EXISTS (
          SELECT 1 FROM public.activity_tiers pr
          WHERE pr.action_id = a.id AND pr.order_ordinal IS NOT NULL
            AND pr.order_ordinal < t.order_ordinal
            AND NOT public.gam_milestone_met(p_retailer, pr.order_ordinal, pr.basis, pr.operator, pr.threshold)
        ) INTO v_blocked;
        IF v_blocked THEN reason := 'earlier_milestone_unmet'; RETURN NEXT; CONTINUE; END IF;

      ELSIF COALESCE(a.tier_mode, 'cumulative') = 'all_or_nothing' THEN
        IF t.order_ordinal IS DISTINCT FROM v_last THEN
          reason := 'ladder_incomplete'; RETURN NEXT; CONTINUE;
        END IF;
        SELECT NOT EXISTS (
          SELECT 1 FROM public.activity_tiers pr
          WHERE pr.action_id = a.id AND pr.order_ordinal IS NOT NULL
            AND NOT public.gam_milestone_met(p_retailer, pr.order_ordinal, pr.basis, pr.operator, pr.threshold)
        ) INTO v_complete;
        IF NOT v_complete THEN reason := 'ladder_incomplete'; RETURN NEXT; CONTINUE; END IF;

        SELECT COALESCE(SUM(pr.points), 0) INTO v_pay
        FROM public.activity_tiers pr WHERE pr.action_id = a.id AND pr.order_ordinal IS NOT NULL;

        SELECT COALESCE(SUM(p2.points), 0) INTO v_paid
        FROM public.gamification_points p2
        WHERE p2.action_id = a.id AND p2.user_id = p_user AND p2.retailer_id = p_retailer
          AND p2.reference_type = 'order_milestone';

        v_pay := v_pay - v_paid;
        IF v_pay <= 0 THEN
          points := 0; reason := 'ladder_already_paid'; RETURN NEXT; CONTINUE;
        END IF;
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
         jsonb_build_object('trigger', 'new_retailer_activation', 'milestone_ordinal', t.order_ordinal,
           'tier_id', t.id, 'basis', COALESCE(t.basis, 'order_value'),
           'operator', COALESCE(t.operator, '>='), 'threshold', t.threshold,
           'tier_mode', COALESCE(a.tier_mode, 'cumulative'), 'event_key', v_key, 'context', v_ctx));

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

-- Why did I get these points?
--
-- The points history could say what was earned and never why. For an
-- order-milestone award that gap is acute: the ladder pays 2.5 a rung, the
-- award reads +5, and it is recorded against a single rung — because
-- all_or_nothing pays the whole ladder on the last milestone. Nothing on
-- screen explained that, so a correct award looked like a bug.
--
-- One read-only call assembles the whole explanation: the award, the ladder
-- with every rung marked met or not, the retailer's purchase events, and the
-- orders inside each event.
--
-- RULES AS AT AWARD TIME. The panel must not explain an old award with today's
-- rules — thresholds, points and reward logic are all editable and this ladder
-- has changed repeatedly. The award's own metadata carries what applied when
-- it was earned; `rules_changed` says whether the activity has moved since.
--
-- ENTITLEMENT. The caller sees customer detail only for their own awards, for
-- someone who reports to them, or as an admin. Everyone else gets the points
-- and the rule but no retailer, order or event values — the same line
-- gam_person_detail draws. The modal that calls this is self-only today; the
-- check is here so the panel can be reused from the leaderboard without
-- leaking a peer's customers.
create or replace function public.gam_award_explanation(p_award_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
DECLARE
  gp record;
  act record;
  v_full boolean;
  v_key text;
  v_ordinal integer;
  v_award jsonb;
  v_ladder jsonb := '[]'::jsonb;
  v_events jsonb := '[]'::jsonb;
  v_changed boolean := false;
  t record;
  e record;
BEGIN
  IF p_award_id IS NULL OR auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authorised');
  END IF;

  SELECT * INTO gp FROM public.gamification_points WHERE id = p_award_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'not_found');
  END IF;

  v_full := gp.user_id = auth.uid()
         OR COALESCE(public.report_can_view_user(auth.uid(), gp.user_id), false)
         OR COALESCE(public.is_admin_or_manager(), false);

  SELECT a.*, g.name AS game_name INTO act
  FROM public.gamification_actions a
  JOIN public.gamification_games g ON g.id = a.game_id
  WHERE a.id = gp.action_id;

  v_award := jsonb_build_object(
    'id', gp.id,
    'earned_at', gp.earned_at,
    'points', gp.points,
    'is_correction', gp.points < 0,
    'activity', COALESCE(act.action_name, 'Activity'),
    'game', COALESCE(act.game_name, ''),
    'reference_type', gp.reference_type,
    'reference_id', CASE WHEN v_full THEN gp.reference_id END,
    'retailer_id', CASE WHEN v_full THEN gp.retailer_id END,
    'retailer_name', CASE WHEN v_full THEN
        (SELECT r.name FROM public.retailers r WHERE r.id = gp.retailer_id) END,
    'expires_at', gp.expires_at,
    'status', gp.status
  );

  -- Anything that is not an order-milestone award is explained by its own
  -- facts; the panel falls back to those rather than showing an empty sheet.
  IF gp.reference_type IS DISTINCT FROM 'order_milestone' OR gp.retailer_id IS NULL THEN
    RETURN jsonb_build_object(
      'kind', 'simple', 'full_detail', v_full, 'award', v_award,
      'metadata', CASE WHEN v_full THEN gp.metadata ELSE '{}'::jsonb END
    );
  END IF;

  v_key := gp.metadata->>'event_key';
  v_ordinal := NULLIF(gp.metadata->>'milestone_ordinal', '')::integer;

  -- The ladder, each rung judged against the retailer's purchase events.
  FOR t IN
    SELECT tt.order_ordinal, tt.operator, tt.threshold, tt.points, tt.sort
    FROM public.activity_tiers tt
    WHERE tt.action_id = gp.action_id AND tt.order_ordinal IS NOT NULL
    ORDER BY tt.sort, tt.order_ordinal
  LOOP
    v_ladder := v_ladder || jsonb_build_object(
      'ordinal', t.order_ordinal,
      'operator', t.operator,
      'threshold', t.threshold,
      'points', t.points,
      'is_award_rung', t.order_ordinal = v_ordinal,
      'met', public.gam_milestone_met(gp.retailer_id, t.order_ordinal, 'order_value',
                                      t.operator, t.threshold),
      'event_value', CASE WHEN v_full THEN
          (SELECT x.order_value FROM public.gam_retailer_purchase_events(gp.retailer_id) x
            WHERE x.ordinal = t.order_ordinal) END,
      'awarded', EXISTS (
        SELECT 1 FROM public.gamification_points p2
        WHERE p2.action_id = gp.action_id AND p2.user_id = gp.user_id
          AND p2.retailer_id = gp.retailer_id
          AND p2.reference_type = 'order_milestone'
          AND (p2.metadata->>'milestone_ordinal')::integer = t.order_ordinal)
    );

    -- Did the rule move after the award was made?
    IF t.order_ordinal = v_ordinal THEN
      IF t.threshold IS DISTINCT FROM NULLIF(gp.metadata->>'threshold','')::numeric
         OR t.operator IS DISTINCT FROM gp.metadata->>'operator' THEN
        v_changed := true;
      END IF;
    END IF;
  END LOOP;

  IF COALESCE(act.tier_mode, 'cumulative') IS DISTINCT FROM gp.metadata->>'tier_mode' THEN
    v_changed := true;
  END IF;

  -- Purchase events, with the orders inside each one.
  IF v_full THEN
    FOR e IN
      SELECT x.ordinal, x.event_key, x.first_at, x.order_value
      FROM public.gam_retailer_purchase_events(gp.retailer_id) x
      ORDER BY x.ordinal
    LOOP
      v_events := v_events || jsonb_build_object(
        'ordinal', e.ordinal,
        'event_key', e.event_key,
        'grouped_by', CASE WHEN e.event_key LIKE 'day:%' THEN 'day' ELSE 'visit' END,
        'first_at', e.first_at,
        'value', e.order_value,
        'is_award_event', e.event_key = v_key,
        'orders', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
                   'id', o.id, 'order_date', o.order_date,
                   'amount', o.total_amount, 'status', o.status)
                 ORDER BY o.created_at)
          FROM public.orders o
          WHERE o.retailer_id = gp.retailer_id
            AND COALESCE(o.visit_id::text, 'day:' || o.order_date::text) = e.event_key
            AND COALESCE(o.status, '') NOT IN ('cancelled', 'replaced')
        ), '[]'::jsonb)
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'kind', 'milestone',
    'full_detail', v_full,
    'award', v_award,
    'rule', jsonb_build_object(
      'milestone_ordinal', v_ordinal,
      'threshold', NULLIF(gp.metadata->>'threshold','')::numeric,
      'operator', gp.metadata->>'operator',
      'tier_mode', gp.metadata->>'tier_mode',
      'event_key', v_key,
      'event_value_at_award', NULLIF(gp.metadata->'context'->>'order_value','')::numeric
    ),
    'ladder', v_ladder,
    'events', v_events,
    'ladder_total', (SELECT COALESCE(SUM(tt.points), 0) FROM public.activity_tiers tt
                      WHERE tt.action_id = gp.action_id AND tt.order_ordinal IS NOT NULL),
    'rules_changed', v_changed
  );
END;
$function$;

revoke all on function public.gam_award_explanation(uuid) from public;
grant execute on function public.gam_award_explanation(uuid) to authenticated;

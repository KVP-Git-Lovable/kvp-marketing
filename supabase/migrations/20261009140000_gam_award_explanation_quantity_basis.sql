-- Explain a quantity ladder in quantity.
--
-- Three things were hardcoded to value and would have misreported a quantity
-- ladder rather than merely looking odd:
--
--   1. the met/not-met mark was computed with basis 'order_value', so a rung
--      judged on units was re-judged on rupees and could show a tick the
--      awarder never gave;
--   2. event_value returned order_value, so the panel showed rupees beside a
--      threshold in units;
--   3. nothing said what the quantity was made of.
--
-- The third matters most. A quantity total is the plain sum of the line
-- quantities in the units entered -- it is not converted through the UoM
-- master -- so an event mixing KG and PIECE adds them. Rather than hide that,
-- each event now carries its per-unit breakdown, so "12 units" can be read as
-- "10 PIECE + 2 KG" by anyone asking why a milestone did or did not land.
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
  v_basis text;
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

  IF gp.reference_type IS DISTINCT FROM 'order_milestone' OR gp.retailer_id IS NULL THEN
    RETURN jsonb_build_object(
      'kind', 'simple', 'full_detail', v_full, 'award', v_award,
      'metadata', CASE WHEN v_full THEN gp.metadata ELSE '{}'::jsonb END
    );
  END IF;

  v_key     := gp.metadata->>'event_key';
  v_ordinal := NULLIF(gp.metadata->>'milestone_ordinal', '')::integer;
  -- As at award time, not as configured now.
  v_basis   := COALESCE(NULLIF(gp.metadata->>'basis', ''), 'order_value');

  FOR t IN
    SELECT tt.order_ordinal, tt.operator, tt.threshold, tt.points, tt.sort,
           COALESCE(tt.basis, 'order_value') AS basis
    FROM public.activity_tiers tt
    WHERE tt.action_id = gp.action_id AND tt.order_ordinal IS NOT NULL
    ORDER BY tt.sort, tt.order_ordinal
  LOOP
    v_ladder := v_ladder || jsonb_build_object(
      'ordinal', t.order_ordinal,
      'operator', t.operator,
      'threshold', t.threshold,
      'points', t.points,
      'basis', t.basis,
      'is_award_rung', t.order_ordinal = v_ordinal,
      -- Judged on the rung's own basis, so the tick matches the awarder.
      'met', public.gam_milestone_met(gp.retailer_id, t.order_ordinal, t.basis,
                                      t.operator, t.threshold),
      'event_value', CASE WHEN v_full THEN
          (SELECT CASE WHEN t.basis = 'order_quantity' THEN x.order_quantity
                       ELSE x.order_value END
             FROM public.gam_retailer_purchase_events(gp.retailer_id) x
            WHERE x.ordinal = t.order_ordinal) END,
      'awarded', EXISTS (
        SELECT 1 FROM public.gamification_points p2
        WHERE p2.action_id = gp.action_id AND p2.user_id = gp.user_id
          AND p2.retailer_id = gp.retailer_id
          AND p2.reference_type = 'order_milestone'
          AND (p2.metadata->>'milestone_ordinal')::integer = t.order_ordinal)
    );

    IF t.order_ordinal = v_ordinal THEN
      IF t.threshold IS DISTINCT FROM NULLIF(gp.metadata->>'threshold','')::numeric
         OR t.operator IS DISTINCT FROM gp.metadata->>'operator'
         OR t.basis IS DISTINCT FROM v_basis THEN
        v_changed := true;
      END IF;
    END IF;
  END LOOP;

  IF COALESCE(act.tier_mode, 'cumulative') IS DISTINCT FROM gp.metadata->>'tier_mode' THEN
    v_changed := true;
  END IF;

  IF v_full THEN
    FOR e IN
      SELECT x.ordinal, x.event_key, x.first_at, x.order_value, x.order_quantity
      FROM public.gam_retailer_purchase_events(gp.retailer_id) x
      ORDER BY x.ordinal
    LOOP
      v_events := v_events || jsonb_build_object(
        'ordinal', e.ordinal,
        'event_key', e.event_key,
        'grouped_by', CASE WHEN e.event_key LIKE 'day:%' THEN 'day' ELSE 'visit' END,
        'first_at', e.first_at,
        'value', e.order_value,
        'quantity', e.order_quantity,
        'is_award_event', e.event_key = v_key,
        -- What the quantity is made of. Nothing converts between units, so
        -- this is the only honest way to present a mixed-unit total.
        'units', COALESCE((
          SELECT jsonb_agg(u ORDER BY u->>'unit')
          FROM (
            SELECT jsonb_build_object(
                     'unit', UPPER(COALESCE(NULLIF(TRIM(oi.unit), ''), 'unspecified')),
                     'quantity', SUM(oi.quantity)) AS u
            FROM public.orders o
            JOIN public.order_items oi ON oi.order_id = o.id
            WHERE o.retailer_id = gp.retailer_id
              AND COALESCE(o.visit_id::text, 'day:' || o.order_date::text) = e.event_key
              AND COALESCE(o.status, '') NOT IN ('cancelled', 'replaced')
              AND COALESCE(o.is_backorder, false) = false
            GROUP BY UPPER(COALESCE(NULLIF(TRIM(oi.unit), ''), 'unspecified'))
          ) z
        ), '[]'::jsonb),
        'orders', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
                   'id', o.id, 'order_date', o.order_date,
                   'amount', o.total_amount, 'status', o.status)
                 ORDER BY o.created_at)
          FROM public.orders o
          WHERE o.retailer_id = gp.retailer_id
            AND COALESCE(o.visit_id::text, 'day:' || o.order_date::text) = e.event_key
            AND COALESCE(o.status, '') NOT IN ('cancelled', 'replaced')
            AND COALESCE(o.is_backorder, false) = false
        ), '[]'::jsonb)
      );
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'kind', 'milestone',
    'full_detail', v_full,
    'award', v_award,
    'basis', v_basis,
    'rule', jsonb_build_object(
      'milestone_ordinal', v_ordinal,
      'threshold', NULLIF(gp.metadata->>'threshold','')::numeric,
      'operator', gp.metadata->>'operator',
      'basis', v_basis,
      'tier_mode', gp.metadata->>'tier_mode',
      'event_key', v_key,
      'event_value_at_award', NULLIF(gp.metadata->'context'->>(
        CASE WHEN v_basis = 'order_quantity' THEN 'order_quantity' ELSE 'order_value' END
      ),'')::numeric
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

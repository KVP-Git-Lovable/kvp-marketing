-- Retailer Outlet Conversion Rate (ROCR), rolling 30 days.
-- New, additive feature: no existing table, view, function, or RLS policy is
-- modified. This is the entire backend footprint — one new function, nothing
-- stored, nothing scheduled.
--
-- Window: [today - 30 days, today - 1 day] inclusive, today always excluded
-- (matches the salesperson-level PTV's day-based approach, but scoped to one
-- retailer instead of grouped across all of a user's retailers).
--
-- Planned Day  = retailer was on the caller-scoped user's beat route that day,
--                OR a visit was logged, OR an order was placed — any one
--                qualifies (same 3-source union the existing PTV uses).
-- Productive Day = at least one confirmed order that day (orders only —
--                deliberately narrower than the existing PTV, which also
--                counts a visit marked 'productive'; this was the caller's
--                explicit instruction).
--
-- Access control: p_user_id is not implicitly trusted. The caller may ask
-- for their own data, a subordinate's data (existing is_subordinate_of, used
-- the same way by can_view_retailer_ledger in a prior migration), or ask as
-- a system admin. Anyone else is refused.

CREATE OR REPLACE FUNCTION public.get_retailer_rocr_30d(
  p_retailer_id uuid,
  p_user_id uuid
)
RETURNS TABLE (
  planned_days integer,
  productive_days integer,
  rocr_percent numeric,
  window_start date,
  window_end date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_start date := (current_date - interval '30 days')::date;
  v_end   date := (current_date - interval '1 day')::date;
BEGIN
  -- auth.uid() IS NULL is checked explicitly and first: "auth.uid() = p_user_id"
  -- alone evaluates to NULL (not false) when unauthenticated, and PL/pgSQL's
  -- "IF NOT (NULL)" silently skips the exception instead of raising it — this
  -- would otherwise let any unauthenticated/service-role caller through.
  IF auth.uid() IS NULL OR NOT (
    auth.uid() = p_user_id
    OR public.is_subordinate_of(auth.uid(), p_user_id)
    OR public.is_system_admin(auth.uid())
  ) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH days AS (
    SELECT generate_series(v_start, v_end, interval '1 day')::date AS d
  ),
  route_days AS (
    SELECT DISTINCT bp.plan_date::date AS d
    FROM beat_plans bp
    JOIN retailers r ON r.beat_id = bp.beat_id AND r.user_id = bp.user_id
    WHERE r.id = p_retailer_id AND bp.user_id = p_user_id
      AND bp.plan_date BETWEEN v_start AND v_end
  ),
  visit_days AS (
    SELECT DISTINCT v.planned_date::date AS d
    FROM visits v
    WHERE v.retailer_id = p_retailer_id AND v.user_id = p_user_id
      AND v.planned_date BETWEEN v_start AND v_end
  ),
  order_days AS (
    SELECT DISTINCT o.order_date::date AS d
    FROM orders o
    WHERE o.retailer_id = p_retailer_id AND o.user_id = p_user_id
      AND o.status = 'confirmed'
      AND o.order_date BETWEEN v_start AND v_end
  ),
  scored AS (
    SELECT d.d,
           (d.d IN (SELECT d FROM route_days)
         OR d.d IN (SELECT d FROM visit_days)
         OR d.d IN (SELECT d FROM order_days)) AS is_planned,
           d.d IN (SELECT d FROM order_days) AS is_productive
    FROM days d
  )
  SELECT
    count(*) FILTER (WHERE is_planned)::int,
    count(*) FILTER (WHERE is_productive)::int,
    CASE WHEN count(*) FILTER (WHERE is_planned) > 0
      THEN round((count(*) FILTER (WHERE is_productive)::numeric
                  / count(*) FILTER (WHERE is_planned)) * 100, 2)
      ELSE 0 END,
    v_start, v_end
  FROM scored;
END;
$fn$;

REVOKE ALL ON FUNCTION public.get_retailer_rocr_30d(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_retailer_rocr_30d(uuid, uuid) TO authenticated;

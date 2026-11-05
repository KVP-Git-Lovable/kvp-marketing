-- Recovered: the redemption policy / reset / approval schema.
--
-- These objects reached staging as seven migrations (gam_policy_P1..P7, applied
-- 2026-09-24 05:16-05:27) whose FILES were never committed. The commit that
-- carried the client code for them -- f21c39cd, "admin-configurable redemption
-- policy, period reset and approvals" -- changed five .tsx files and no SQL, so
-- the repo could not rebuild this schema on any other environment and the
-- migrations that follow this one depended on objects nothing declared.
--
-- This file is reconstructed from the live database (pg_get_functiondef and
-- catalogue introspection), not from the original scripts, so it reproduces the
-- resulting SCHEMA rather than the exact statements that produced it. It is
-- dated ahead of the redemption-workflow migrations because that is the order
-- staging applied them in, and the later ones replace several of these
-- functions.
--
-- Everything is written to be re-runnable against a database that already has
-- some of it.


-- ---------------------------------------------------------------- P1: schema

-- Redemption policy, and the period-reset settings, on the singleton row.
alter table public.gamification_settings
  add column if not exists redeem_min_points        numeric not null default 0,
  add column if not exists redeem_multiple_of       numeric,
  add column if not exists redeem_max_per_request   numeric,
  add column if not exists redeem_cooldown_days     integer not null default 0,
  add column if not exists redeem_requires_approval boolean not null default true,
  add column if not exists reset_cadence            text    not null default 'never',
  add column if not exists reset_mode               text    not null default 'expire',
  add column if not exists reset_grace_days         integer not null default 0,
  add column if not exists reset_lifetime_visible   boolean not null default true,
  add column if not exists last_reset_period        text;

-- policy_snapshot records the rules AS THEY STOOD when the request was raised,
-- so tightening the policy later cannot retroactively invalidate a request
-- somebody is already waiting on.
alter table public.gamification_redemptions
  add column if not exists period_key          text,
  add column if not exists policy_snapshot     jsonb,
  add column if not exists approval_request_id uuid;

-- Unanimous routing: every level must approve, in order. Off by default, so
-- leave, expenses, regularisation, credit notes and order edits keep the
-- first-response behaviour they have today.
alter table public.approval_config
  add column if not exists require_all_levels boolean not null default false;

-- Redemptions ride the shared approval engine. One row, keyed by entity_type,
-- exactly like every other approvable thing.
insert into public.approval_config
  (entity_type, use_full_hierarchy, max_levels, skip_levels, approval_mode, require_all_levels)
select 'gamification_redemption', false, 1, false, 'manager', false
where not exists (
  select 1 from public.approval_config where entity_type = 'gamification_redemption'
);


-- ------------------------------------------------------- P4: reserved status

-- Points backing an open request are neither spendable nor spent.
alter table public.gamification_points
  drop constraint if exists gamification_points_status_check;

alter table public.gamification_points
  add constraint gamification_points_status_check
  check (status = any (array['active'::text, 'expired'::text, 'redeemed'::text, 'reserved'::text]));


-- -------------------------------------------- P5: let a split row past dedupe

-- Reserving part of an award splits the row, and the copy carries the same
-- order id and tier as its parent -- which the dedupe indexes read as a second
-- award for the same thing and refused. They now ignore rows marked
-- split_from, so a split can never be mistaken for a duplicate payout.
drop index if exists public.gamification_points_user_action_order_uniq;
create unique index gamification_points_user_action_order_uniq
  on public.gamification_points (user_id, action_id, ((metadata ->> 'order_id')))
  where (metadata ? 'order_id') and not (metadata ? 'split_from');

drop index if exists public.ux_gam_points_target_tier_once;
create unique index ux_gam_points_target_tier_once
  on public.gamification_points (action_id, user_id, period_key, ((metadata ->> 'tier_threshold')))
  where reference_type = 'target_tier' and not (metadata ? 'split_from');

drop index if exists public.ux_gam_points_visit_tier_once;
create unique index ux_gam_points_visit_tier_once
  on public.gamification_points (action_id, user_id, period_key, ((metadata ->> 'tier_threshold')))
  where reference_type = 'visit_tier' and not (metadata ? 'split_from');


-- --------------------------------------------------- P3: period close archive

-- A reset must never cost the total-earned record, so each cycle is archived
-- before anything lapses.
create table if not exists public.gamification_points_history (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  period_key       text not null,
  period_type      text not null,
  period_start     timestamptz not null,
  period_end       timestamptz not null,
  opening_balance  numeric not null default 0,
  points_earned    numeric not null default 0,
  points_redeemed  numeric not null default 0,
  points_expired   numeric not null default 0,
  closing_balance  numeric not null default 0,
  lifetime_earned  numeric not null default 0,
  reset_mode       text,
  archived_at      timestamptz not null default now()
);

create unique index if not exists gam_points_history_uniq
  on public.gamification_points_history (user_id, period_key);
create index if not exists idx_gam_hist_user   on public.gamification_points_history (user_id);
create index if not exists idx_gam_hist_period on public.gamification_points_history (period_key);

alter table public.gamification_points_history enable row level security;

drop policy if exists "own or permitted points history" on public.gamification_points_history;
create policy "own or permitted points history"
  on public.gamification_points_history
  for select
  using (user_id = auth.uid() or public.gam_can_view_detail(user_id));


-- --------------------------------------------------------- P2/P3: functions

-- Period boundaries for every supported cadence, including the Indian
-- financial year. 'never' returns no row at all.
create or replace function public.gam_period_bounds(
  p_cadence text,
  p_ts timestamptz default now()
)
returns table(period_key text, period_start timestamptz, period_end timestamptz)
language plpgsql
immutable
set search_path to 'public'
as $function$
DECLARE s timestamptz; e timestamptz; k text; fy_start timestamptz;
BEGIN
  IF p_cadence = 'monthly' THEN
    s := date_trunc('month', p_ts);
    e := s + interval '1 month';
    k := to_char(s, 'YYYY-MM');

  ELSIF p_cadence = 'quarterly' THEN
    s := date_trunc('quarter', p_ts);
    e := s + interval '3 months';
    k := to_char(s, 'YYYY') || '-Q' || extract(quarter from s)::int;

  ELSIF p_cadence = 'half_yearly' THEN
    s := CASE WHEN extract(month from p_ts) <= 6
              THEN date_trunc('year', p_ts)
              ELSE date_trunc('year', p_ts) + interval '6 months' END;
    e := s + interval '6 months';
    k := to_char(s, 'YYYY') || CASE WHEN extract(month from s) = 1 THEN '-H1' ELSE '-H2' END;

  ELSIF p_cadence = 'annual' THEN
    s := date_trunc('year', p_ts);
    e := s + interval '1 year';
    k := to_char(s, 'YYYY');

  ELSIF p_cadence = 'financial_year' THEN
    fy_start := CASE WHEN extract(month from p_ts) >= 4
                     THEN date_trunc('year', p_ts) + interval '3 months'
                     ELSE date_trunc('year', p_ts) - interval '9 months' END;
    s := fy_start;
    e := fy_start + interval '1 year';
    k := 'FY' || to_char(s, 'YYYY') || '-' || to_char(e - interval '1 day', 'YY');

  ELSE
    RETURN;  -- 'never' yields no period
  END IF;

  period_key := k; period_start := s; period_end := e;
  RETURN NEXT;
END; $function$;


-- The rep's request. Applies the admin's policy in the database, so the app, an
-- offline sync and a direct API call all hit the same gates; reserves the
-- points oldest-first, splitting the boundary row; and raises the approval
-- request. NOTE: a later migration separates approval from payment, so the
-- settle this calls no longer redeems on approval.
create or replace function public.gam_redeem_request(
  p_user_id uuid,
  p_points  numeric,
  p_note    text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  st          gamification_settings%ROWTYPE;
  v_avail     numeric;
  v_left      numeric;
  v_red_id    uuid;
  v_req_id    uuid;
  v_last      timestamptz;
  r           record;
  v_take      numeric;
  v_pk        text;
BEGIN
  SELECT * INTO st FROM gamification_settings LIMIT 1;
  IF st.engine_enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'Gamification is currently disabled';
  END IF;
  IF p_points IS NULL OR p_points <= 0 THEN
    RAISE EXCEPTION 'Redemption amount must be greater than zero';
  END IF;

  -- policy gates
  IF p_points < COALESCE(st.redeem_min_points, 0) THEN
    RAISE EXCEPTION 'You need at least % points to redeem', st.redeem_min_points;
  END IF;
  IF COALESCE(st.redeem_multiple_of, 0) > 0
     AND (p_points::numeric % st.redeem_multiple_of) <> 0 THEN
    RAISE EXCEPTION 'Redemption must be in multiples of % points', st.redeem_multiple_of;
  END IF;
  IF st.redeem_max_per_request IS NOT NULL AND p_points > st.redeem_max_per_request THEN
    RAISE EXCEPTION 'You can redeem at most % points in one request', st.redeem_max_per_request;
  END IF;
  IF COALESCE(st.redeem_cooldown_days, 0) > 0 THEN
    SELECT MAX(requested_at) INTO v_last FROM gamification_redemptions
     WHERE user_id = p_user_id AND status <> 'rejected';
    IF v_last IS NOT NULL AND v_last > now() - make_interval(days => st.redeem_cooldown_days) THEN
      RAISE EXCEPTION 'You can raise another request after % day(s)', st.redeem_cooldown_days;
    END IF;
  END IF;

  -- lock this user's spendable rows so two requests cannot claim the same points
  PERFORM 1 FROM gamification_points
   WHERE user_id = p_user_id AND status = 'active' FOR UPDATE;

  SELECT COALESCE(SUM(points),0) INTO v_avail FROM gamification_points
   WHERE user_id = p_user_id AND status = 'active'
     AND (expires_at IS NULL OR expires_at > now());
  IF v_avail < p_points THEN
    RAISE EXCEPTION 'Insufficient balance: you have % of the % points needed', v_avail, p_points;
  END IF;

  SELECT period_key INTO v_pk FROM gam_period_bounds(st.reset_cadence, now());

  INSERT INTO gamification_redemptions
    (user_id, points_redeemed, voucher_amount, status, requested_at, period_key, policy_snapshot)
  VALUES (p_user_id, p_points, p_points * COALESCE(st.point_conversion,1),
          'pending', now(), v_pk,
          jsonb_build_object('min', st.redeem_min_points, 'multiple_of', st.redeem_multiple_of,
                             'max_per_request', st.redeem_max_per_request,
                             'cooldown_days', st.redeem_cooldown_days,
                             'requires_approval', st.redeem_requires_approval,
                             'conversion', st.point_conversion, 'note', p_note))
  RETURNING id INTO v_red_id;

  -- Reserve oldest-first. The boundary row is SPLIT rather than swallowed, so
  -- a 30-point redemption against a 100-point row leaves 70 spendable.
  v_left := p_points;
  FOR r IN SELECT * FROM gamification_points
            WHERE user_id = p_user_id AND status='active'
              AND (expires_at IS NULL OR expires_at > now())
            ORDER BY earned_at ASC, id ASC
  LOOP
    EXIT WHEN v_left <= 0;
    v_take := LEAST(r.points, v_left);

    IF v_take = r.points THEN
      UPDATE gamification_points
         SET status='reserved', redemption_id=v_red_id WHERE id=r.id;
    ELSE
      UPDATE gamification_points SET points = points - v_take WHERE id = r.id;
      INSERT INTO gamification_points
        (action_id, points, reference_type, reference_id, earned_at, metadata,
         user_id, game_id, expires_at, status, period_key, retailer_id, redemption_id)
      VALUES (r.action_id, v_take, r.reference_type, r.reference_id, r.earned_at,
              COALESCE(r.metadata,'{}'::jsonb) || jsonb_build_object('split_from', r.id),
              r.user_id, r.game_id, r.expires_at, 'reserved', r.period_key,
              r.retailer_id, v_red_id);
    END IF;
    v_left := v_left - v_take;
  END LOOP;

  IF v_left > 0 THEN
    RAISE EXCEPTION 'Could not reserve the full amount (% short)', v_left;
  END IF;

  IF st.redeem_requires_approval THEN
    v_req_id := create_approval_request('gamification_redemption', v_red_id, p_user_id);
    IF v_req_id IS NULL THEN
      -- policy says approve, but no approver could be resolved: fail loudly
      -- rather than silently handing out points.
      RAISE EXCEPTION 'No approver is configured for redemptions. Ask an admin to set the approval policy.';
    END IF;
    UPDATE gamification_redemptions SET approval_request_id = v_req_id WHERE id = v_red_id;
  ELSE
    PERFORM gam_settle_redemption(v_red_id, true, p_user_id, 'Auto-approved by policy');
  END IF;

  RETURN v_red_id;
END; $function$;

revoke all on function public.gam_redeem_request(uuid, numeric, text) from public;
grant execute on function public.gam_redeem_request(uuid, numeric, text) to authenticated;


-- Settle a redemption. THIS VERSION IS SUPERSEDED by the migration that
-- separates approval from payment -- it is here so the recovered history
-- matches what staging ran, and is replaced later in the same sequence.
create or replace function public.gam_settle_redemption(
  p_redemption_id uuid,
  p_approved boolean,
  p_by uuid default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE v_status text; v_uid uuid := auth.uid(); v_ok boolean;
BEGIN
  IF v_uid IS NOT NULL THEN
    SELECT public.is_system_admin(v_uid)
        OR EXISTS (SELECT 1
                     FROM approval_steps s
                     JOIN gamification_redemptions r ON r.approval_request_id = s.approval_request_id
                    WHERE r.id = p_redemption_id AND s.approver_id = v_uid)
      INTO v_ok;
    IF NOT COALESCE(v_ok,false) THEN
      RAISE EXCEPTION 'Your profile does not have permission to settle this redemption';
    END IF;
  END IF;

  SELECT status INTO v_status FROM gamification_redemptions WHERE id = p_redemption_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Redemption % not found', p_redemption_id; END IF;
  IF v_status <> 'pending' THEN RETURN; END IF;

  IF p_approved THEN
    UPDATE gamification_points SET status='redeemed'
     WHERE redemption_id = p_redemption_id AND status='reserved';
    UPDATE gamification_redemptions
       SET status='approved', processed_at=now(), processed_by=COALESCE(p_by, v_uid)
     WHERE id = p_redemption_id;
  ELSE
    UPDATE gamification_points SET status='active', redemption_id=NULL
     WHERE redemption_id = p_redemption_id AND status='reserved';
    UPDATE gamification_redemptions
       SET status='rejected', processed_at=now(), processed_by=COALESCE(p_by, v_uid),
           rejection_reason=COALESCE(p_reason,'Rejected')
     WHERE id = p_redemption_id;
  END IF;
END; $function$;


-- Close a period: archive every user's cycle, then lapse what the mode says.
create or replace function public.gam_run_period_reset(p_dry_run boolean default false)
returns table(period_key text, users_archived integer, points_expired numeric, note text)
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  st gamification_settings%ROWTYPE; cur_start timestamptz; b record;
  v_users int := 0; v_exp numeric := 0; u record; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NOT NULL AND NOT public.is_system_admin(v_uid) THEN
    RAISE EXCEPTION 'Your profile does not have permission to run a points reset';
  END IF;

  SELECT * INTO st FROM gamification_settings LIMIT 1;
  IF st.reset_cadence = 'never' THEN
    RETURN QUERY SELECT NULL::text, 0, 0::numeric, 'points never lapse - nothing to close';
    RETURN;
  END IF;

  SELECT gb.period_start INTO cur_start FROM gam_period_bounds(st.reset_cadence, now()) gb;
  SELECT * INTO b FROM gam_period_bounds(st.reset_cadence, cur_start - interval '1 second');

  IF now() < b.period_end + make_interval(days => COALESCE(st.reset_grace_days,0)) THEN
    RETURN QUERY SELECT b.period_key, 0, 0::numeric,
      format('inside the %s-day grace window after %s',
             COALESCE(st.reset_grace_days,0), b.period_end::date);
    RETURN;
  END IF;

  IF st.last_reset_period IS NOT DISTINCT FROM b.period_key THEN
    RETURN QUERY SELECT b.period_key, 0, 0::numeric, 'already closed';
    RETURN;
  END IF;

  FOR u IN SELECT DISTINCT user_id FROM gamification_points WHERE user_id IS NOT NULL
  LOOP
    DECLARE v_earned numeric; v_red numeric; v_expd numeric;
            v_open numeric; v_close numeric; v_life numeric;
    BEGIN
      SELECT COALESCE(SUM(points) FILTER (WHERE earned_at >= b.period_start
                                            AND earned_at <  b.period_end), 0),
             COALESCE(SUM(points) FILTER (WHERE status='redeemed' AND earned_at < b.period_end), 0),
             COALESCE(SUM(points) FILTER (WHERE status='expired'  AND earned_at < b.period_end), 0),
             COALESCE(SUM(points) FILTER (WHERE earned_at < b.period_start), 0),
             COALESCE(SUM(points), 0)
        INTO v_earned, v_red, v_expd, v_open, v_life
        FROM gamification_points WHERE user_id = u.user_id;

      SELECT COALESCE(SUM(points),0) INTO v_close FROM gamification_points
       WHERE user_id = u.user_id AND status='active' AND earned_at < b.period_end;

      IF NOT p_dry_run THEN
        INSERT INTO gamification_points_history
          (user_id, period_key, period_type, period_start, period_end,
           opening_balance, points_earned, points_redeemed, points_expired,
           closing_balance, lifetime_earned, reset_mode)
        VALUES (u.user_id, b.period_key, st.reset_cadence, b.period_start, b.period_end,
                v_open, v_earned, v_red, v_expd, v_close, v_life, st.reset_mode)
        ON CONFLICT (user_id, period_key) DO UPDATE SET
          points_earned=EXCLUDED.points_earned, points_redeemed=EXCLUDED.points_redeemed,
          points_expired=EXCLUDED.points_expired, closing_balance=EXCLUDED.closing_balance,
          lifetime_earned=EXCLUDED.lifetime_earned, archived_at=now();
      END IF;
      v_users := v_users + 1;
    END;
  END LOOP;

  -- Points RESERVED against an open approval are never lapsed; that request
  -- has to resolve on its own terms first.
  IF st.reset_mode = 'expire' THEN
    IF p_dry_run THEN
      SELECT COALESCE(SUM(points),0) INTO v_exp FROM gamification_points
       WHERE status='active' AND earned_at < b.period_end;
    ELSE
      WITH x AS (UPDATE gamification_points SET status='expired'
                  WHERE status='active' AND earned_at < b.period_end RETURNING points)
      SELECT COALESCE(SUM(points),0) INTO v_exp FROM x;
    END IF;
  END IF;

  IF NOT p_dry_run THEN
    UPDATE gamification_settings SET last_reset_period = b.period_key, updated_at = now();
  END IF;

  RETURN QUERY SELECT b.period_key, v_users, v_exp,
    CASE WHEN p_dry_run THEN 'dry run - nothing written' ELSE 'closed' END;
END; $function$;

revoke all on function public.gam_run_period_reset(boolean) from public;
grant execute on function public.gam_run_period_reset(boolean) to authenticated;


-- ------------------------------------------------- P6: sequential approvals

-- require_all_levels = unanimous: every level approves, in order, and the
-- request only completes on the last one. false keeps the original
-- first-response behaviour for every other entity type.
create or replace function public.process_approval_step(
  p_approval_request_id uuid,
  p_approver_id uuid,
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_request RECORD;
  v_step    RECORD;
  v_seq     boolean := false;
  v_pending int;
  v_next    int;
  v_act     text;
BEGIN
  -- tolerate 'approve'/'approved' and 'reject'/'rejected' so a mistyped verb
  -- can never be silently treated as an approval
  v_act := CASE WHEN lower(p_action) LIKE 'reject%' THEN 'rejected'
                WHEN lower(p_action) LIKE 'approv%' THEN 'approved'
                ELSE lower(p_action) END;
  IF v_act NOT IN ('approved','rejected') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unknown action: '||p_action);
  END IF;

  SELECT * INTO v_request FROM approval_requests WHERE id = p_approval_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Request not found');
  END IF;
  IF v_request.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Request already processed');
  END IF;

  SELECT COALESCE(require_all_levels,false) INTO v_seq
    FROM approval_config WHERE entity_type = v_request.entity_type;
  v_seq := COALESCE(v_seq, false);

  IF v_seq THEN
    SELECT * INTO v_step FROM approval_steps
     WHERE approval_request_id = p_approval_request_id
       AND approver_id = p_approver_id AND status='pending'
       AND level = v_request.current_level
     LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false,
        'message', 'It is not your turn to approve this request yet');
    END IF;
  ELSE
    SELECT * INTO v_step FROM approval_steps
     WHERE approval_request_id = p_approval_request_id
       AND approver_id = p_approver_id AND status='pending'
     ORDER BY level ASC LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'message', 'No pending step found for this approver');
    END IF;
  END IF;

  UPDATE approval_steps
     SET status=v_act, action_taken_at=now(), rejection_reason=p_reason
   WHERE id = v_step.id;

  INSERT INTO approval_audit_log
    (approval_request_id, entity_type, entity_id, action, performed_by, level, metadata)
  VALUES (p_approval_request_id, v_request.entity_type, v_request.entity_id, v_act,
          p_approver_id, v_step.level, jsonb_build_object('reason', p_reason, 'sequential', v_seq));

  IF v_act = 'rejected' THEN
    UPDATE approval_steps SET status='skipped', action_taken_at=now()
     WHERE approval_request_id=p_approval_request_id AND id<>v_step.id AND status='pending';
    UPDATE approval_requests SET status='rejected', updated_at=now()
     WHERE id = p_approval_request_id;
    RETURN jsonb_build_object('success', true, 'message', 'Request rejected',
                              'is_final', true, 'action', 'rejected');
  END IF;

  IF v_seq THEN
    SELECT count(*), MIN(level) INTO v_pending, v_next FROM approval_steps
     WHERE approval_request_id=p_approval_request_id AND status='pending';
    IF v_pending > 0 THEN
      UPDATE approval_requests SET current_level=v_next, updated_at=now()
       WHERE id = p_approval_request_id;
      RETURN jsonb_build_object('success', true, 'message', 'Approved - sent to the next approver',
                                'is_final', false, 'next_level', v_next, 'action', 'approved');
    END IF;
  ELSE
    UPDATE approval_steps SET status='skipped', action_taken_at=now()
     WHERE approval_request_id=p_approval_request_id AND id<>v_step.id AND status='pending';
  END IF;

  UPDATE approval_requests
     SET status='approved', final_approved_by=p_approver_id, updated_at=now()
   WHERE id = p_approval_request_id;

  RETURN jsonb_build_object('success', true, 'message', 'Request approved',
                            'is_final', true, 'action', 'approved');
END; $function$;


-- --------------------------------------------- P7: settle on engine outcome

create or replace function public.tg_gam_redemption_approval_complete()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
BEGIN
  IF NEW.entity_type <> 'gamification_redemption' THEN RETURN NEW; END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  IF NEW.status = 'approved' THEN
    PERFORM gam_settle_redemption(NEW.entity_id, true, NEW.final_approved_by, NULL);
  ELSIF NEW.status = 'rejected' THEN
    PERFORM gam_settle_redemption(NEW.entity_id, false, NEW.final_approved_by,
             (SELECT rejection_reason FROM approval_steps
               WHERE approval_request_id = NEW.id AND status='rejected'
               ORDER BY action_taken_at DESC LIMIT 1));
  END IF;
  RETURN NEW;
END; $function$;

drop trigger if exists trg_gam_redemption_approval_complete on public.approval_requests;
create trigger trg_gam_redemption_approval_complete
  after update of status on public.approval_requests
  for each row execute function public.tg_gam_redemption_approval_complete();

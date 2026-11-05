-- Reconcile the two redemption implementations that landed the same morning.
--
-- Two were built in parallel. The policy/approval one (gam_redeem_request,
-- gam_settle_redemption, reserved points, the shared approval engine) is the
-- better front half and is kept. The workflow one (this branch) is kept for the
-- half it had that the other did not: a payment step.
--
-- The whole point of the requirement was that approval and payment are
-- different events -- "Approval should not automatically mean the money has
-- been given" -- and gam_settle_redemption burned the points the moment a
-- manager approved. So approval no longer burns; the reserved points stay
-- reserved, and gam_mark_redemption_paid is the only thing that redeems them.
--
--   active --request--> reserved --approve--> reserved --pay--> redeemed
--                          |                     |
--                          +--reject/cancel------+--> active again
--
-- Superseded and dropped: gam_request_redemption (gam_redeem_request does the
-- same job and also snapshots the policy, stamps the period and raises the
-- approval request).
--
-- Two live requests predate all of this and carry no approval_request_id and no
-- reserved points -- Abhishek's 1,000 and Dharmesh's 110. Both paths below fall
-- back for them rather than leaving them permanently unactionable.

drop function if exists public.gam_request_redemption(numeric);
drop function if exists public.gam_can_action_redemption(uuid);


-- Who may act on a redemption.
--
-- Takes the redemption, not the requester, because entitlement now depends on
-- the approval request the engine raised for it. Three ways in -- an admin, the
-- engine's designated approver, or a manager above the requester (which covers
-- rows raised before the engine existed, and the payment step after the
-- approval request has closed).
--
-- The self-check is first and beats all three. An admin approving their own
-- payout is the one thing this must never allow, and two of the three system
-- admins here are also earners.
create or replace function public.gam_can_settle_redemption(p_redemption uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select auth.uid() is not null
     and exists (
       select 1
       from public.gamification_redemptions r
       where r.id = p_redemption
         and r.user_id <> auth.uid()
         and (
           coalesce(public.is_admin_or_manager(), false)
           or (r.approval_request_id is not null
               and coalesce(public.is_approver_for_request(r.approval_request_id, auth.uid()), false))
           or exists (
             select 1 from public.get_all_subordinates(auth.uid()) s
             where s.subordinate_user_id = r.user_id and s.level > 0
           )
         )
     );
$function$;

revoke all on function public.gam_can_settle_redemption(uuid) from public;
grant execute on function public.gam_can_settle_redemption(uuid) to authenticated;


-- Approval is a DECISION. It no longer moves points.
--
-- Previously this flipped reserved -> redeemed, so approving and paying were
-- the same keystroke. The points now stay reserved until somebody confirms the
-- reward actually went out; a rejection still releases them immediately.
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
DECLARE v_status text; v_uid uuid := auth.uid(); v_user uuid;
BEGIN
  -- auth.uid() is NULL for the approval trigger, cron and server-side calls;
  -- those were authorised by the engine that invoked them.
  IF v_uid IS NOT NULL AND NOT public.gam_can_settle_redemption(p_redemption_id) THEN
    RAISE EXCEPTION 'Your profile does not have permission to settle this redemption'
      USING ERRCODE = '42501';
  END IF;

  SELECT status, user_id INTO v_status, v_user
    FROM public.gamification_redemptions WHERE id = p_redemption_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Redemption % not found', p_redemption_id;
  END IF;
  IF v_status <> 'pending' THEN RETURN; END IF;   -- idempotent

  IF p_approved THEN
    -- Points deliberately untouched. They are already reserved, and they stay
    -- reserved until gam_mark_redemption_paid says the money has gone.
    UPDATE public.gamification_redemptions
       SET status = 'approved',
           approved_by = COALESCE(p_by, v_uid),
           approved_at = now(),
           processed_at = now(),
           processed_by = COALESCE(p_by, v_uid)
     WHERE id = p_redemption_id;

    PERFORM public.send_notification(
      v_user, 'Redemption approved',
      'Your redemption was approved. Payment is being arranged.',
      'success', 'gamification_redemptions', p_redemption_id);
  ELSE
    UPDATE public.gamification_points
       SET status = 'active', redemption_id = NULL
     WHERE redemption_id = p_redemption_id AND status = 'reserved';

    UPDATE public.gamification_redemptions
       SET status = 'rejected', processed_at = now(),
           processed_by = COALESCE(p_by, v_uid),
           rejection_reason = COALESCE(p_reason, 'Rejected')
     WHERE id = p_redemption_id;

    PERFORM public.send_notification(
      v_user, 'Redemption rejected', COALESCE(p_reason, 'Rejected'),
      'warning', 'gamification_redemptions', p_redemption_id);
  END IF;
END;
$function$;


-- What the queue's Approve / Reject buttons call.
--
-- Routes through the shared approval engine when there is a request to advance,
-- so approval_steps, multi-level routing and the unanimous setting all keep
-- working and the engine's own trigger does the settling. Only when there is no
-- approval request -- auto-approval configured off, or a row raised before the
-- engine covered redemptions -- does it settle directly.
create or replace function public.gam_decide_redemption(
  p_id      uuid,
  p_approve boolean,
  p_reason  text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_me  uuid := auth.uid();
  v_r   record;
  v_req record;
  v_res jsonb;
BEGIN
  SELECT * INTO v_r FROM public.gamification_redemptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Redemption not found'; END IF;

  IF NOT public.gam_can_settle_redemption(p_id) THEN
    RAISE EXCEPTION 'You cannot action this request' USING ERRCODE = '42501';
  END IF;

  IF v_r.status <> 'pending' THEN
    RAISE EXCEPTION 'This request is already %', v_r.status USING ERRCODE = 'check_violation';
  END IF;

  IF NOT p_approve AND (p_reason IS NULL OR btrim(p_reason) = '') THEN
    RAISE EXCEPTION 'Give a reason -- it is the only thing the rep will see';
  END IF;

  IF v_r.approval_request_id IS NOT NULL THEN
    SELECT * INTO v_req FROM public.approval_requests WHERE id = v_r.approval_request_id;

    IF FOUND AND v_req.status = 'pending' THEN
      v_res := public.process_approval_step(
        v_r.approval_request_id, v_me,
        CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
        NULLIF(btrim(COALESCE(p_reason, '')), ''));

      -- The engine refuses politely rather than raising, so a false here would
      -- otherwise look like success to the caller.
      IF NOT COALESCE((v_res->>'success')::boolean, false) THEN
        RAISE EXCEPTION '%', COALESCE(v_res->>'message', 'The approval engine refused this step')
          USING ERRCODE = 'check_violation';
      END IF;

      -- Its trigger settles the redemption once the request completes. On a
      -- multi-level route it stays pending until the last approver, which is
      -- the intended behaviour.
      RETURN;
    END IF;
  END IF;

  PERFORM public.gam_settle_redemption(p_id, p_approve, v_me, p_reason);
END;
$function$;

revoke all on function public.gam_decide_redemption(uuid, boolean, text) from public;
grant execute on function public.gam_decide_redemption(uuid, boolean, text) to authenticated;


-- The reward actually went out. The ONLY step that redeems points.
create or replace function public.gam_mark_redemption_paid(
  p_id        uuid,
  p_mode      text,
  p_reference text,
  p_note      text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_me uuid := auth.uid();
  v_r  record;
  v_reserved numeric;
BEGIN
  SELECT * INTO v_r FROM public.gamification_redemptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Redemption not found'; END IF;

  IF NOT public.gam_can_settle_redemption(p_id) THEN
    RAISE EXCEPTION 'You cannot action this request' USING ERRCODE = '42501';
  END IF;

  IF v_r.status <> 'approved' THEN
    RAISE EXCEPTION 'Only an approved request can be marked paid (this one is %)', v_r.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_mode IS NULL OR btrim(p_mode) = '' OR p_reference IS NULL OR btrim(p_reference) = '' THEN
    RAISE EXCEPTION 'Record how it was paid and a reference';
  END IF;

  -- The normal path: the request already reserved exactly the right rows at
  -- request time, so paying is just letting go of them.
  SELECT COALESCE(sum(points), 0) INTO v_reserved
  FROM public.gamification_points
  WHERE redemption_id = p_id AND status = 'reserved';

  IF v_reserved > 0 THEN
    UPDATE public.gamification_points
       SET status = 'redeemed'
     WHERE redemption_id = p_id AND status = 'reserved';
  ELSE
    -- Nothing reserved: a row raised before reservation existed. Burn it now,
    -- exactly and oldest-first, rather than paying out points that never leave
    -- the balance.
    PERFORM public.gam_burn_points(v_r.user_id, v_r.points_redeemed, p_id);
  END IF;

  UPDATE public.gamification_redemptions
     SET status = 'paid', paid_by = v_me, paid_at = now(),
         payment_mode = btrim(p_mode),
         payment_reference = btrim(p_reference),
         payment_note = nullif(btrim(coalesce(p_note, '')), ''),
         voucher_code = coalesce(voucher_code, btrim(p_reference))
   WHERE id = p_id;

  PERFORM public.send_notification(
    v_r.user_id, 'Reward sent',
    format('%s%s redemption has been sent.', '₹', trunc(v_r.voucher_amount)),
    'success', 'gamification_redemptions', p_id);
END;
$function$;

revoke all on function public.gam_mark_redemption_paid(uuid, text, text, text) from public;
grant execute on function public.gam_mark_redemption_paid(uuid, text, text, text) to authenticated;


-- Withdrawing releases the reservation.
create or replace function public.gam_cancel_redemption(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE v_r record;
BEGIN
  SELECT * INTO v_r FROM public.gamification_redemptions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Redemption not found'; END IF;
  IF v_r.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'That is not your request' USING ERRCODE = '42501';
  END IF;
  IF v_r.status <> 'pending' THEN
    RAISE EXCEPTION 'Once a manager has actioned it, it is no longer yours to withdraw'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.gamification_points
     SET status = 'active', redemption_id = NULL
   WHERE redemption_id = p_id AND status = 'reserved';

  UPDATE public.gamification_redemptions
     SET status = 'cancelled', cancelled_at = now()
   WHERE id = p_id;
END;
$function$;


-- One definition of what is spendable, and it no longer subtracts twice.
--
-- This used to be balance minus open requests, which was right when a request
-- only committed points on paper. Reservation moves them out of 'active', so
-- gam_user_balance has already excluded them -- subtracting the request as well
-- charged the rep twice and would have shown 200 available to someone holding
-- 1,000 who had asked for 400.
create or replace function public.gam_available_to_redeem(p_user uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $function$
  select greatest(0, public.gam_user_balance(p_user));
$function$;


-- The queue, now keyed on who may settle each row rather than on the reporting
-- line alone, and carrying the approval request so the UI can say whose turn it is.
drop function if exists public.gam_redemption_queue(text[]);

create function public.gam_redemption_queue(p_statuses text[] default null)
returns table (
  id uuid,
  user_id uuid,
  person text,
  points_redeemed numeric,
  voucher_amount numeric,
  status text,
  requested_at timestamptz,
  approved_at timestamptz,
  approved_by_name text,
  paid_at timestamptz,
  paid_by_name text,
  payment_mode text,
  payment_reference text,
  payment_note text,
  rejection_reason text,
  balance numeric,
  available numeric,
  approval_request_id uuid,
  my_turn boolean
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select r.id, r.user_id,
         coalesce(p.full_name, p.username, 'Unknown user')::text,
         r.points_redeemed, r.voucher_amount, r.status,
         r.requested_at, r.approved_at,
         coalesce(ap.full_name, ap.username)::text,
         r.paid_at,
         coalesce(pp.full_name, pp.username)::text,
         r.payment_mode, r.payment_reference, r.payment_note, r.rejection_reason,
         public.gam_user_balance(r.user_id),
         public.gam_available_to_redeem(r.user_id),
         r.approval_request_id,
         -- An admin can always act; an engine approver only when a step of
         -- theirs is actually pending, so a unanimous route does not offer
         -- Approve to somebody whose turn has not come.
         (coalesce(public.is_admin_or_manager(), false)
          or r.approval_request_id is null
          or exists (select 1 from public.approval_steps s
                      where s.approval_request_id = r.approval_request_id
                        and s.approver_id = auth.uid() and s.status = 'pending'))
  from public.gamification_redemptions r
  join public.profiles p on p.id = r.user_id
  left join public.profiles ap on ap.id = r.approved_by
  left join public.profiles pp on pp.id = coalesce(r.paid_by, r.processed_by)
  where public.gam_can_settle_redemption(r.id)
    and (p_statuses is null or r.status = any(p_statuses))
  order by
    case r.status when 'pending' then 0 when 'approved' then 1 else 2 end,
    r.requested_at asc;
$function$;

revoke all on function public.gam_redemption_queue(text[]) from public;
grant execute on function public.gam_redemption_queue(text[]) to authenticated;


-- Anyone with people under them has a queue, admin console access or not --
-- six of the eight managers here cannot open /gamification-admin at all.
create or replace function public.gam_has_redemption_queue()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select auth.uid() is not null
     and (
       coalesce(public.is_admin_or_manager(), false)
       or exists (select 1 from public.get_all_subordinates(auth.uid()) s where s.level > 0)
       or exists (select 1 from public.approval_steps s where s.approver_id = auth.uid())
     );
$function$;
